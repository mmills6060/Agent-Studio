import { readFile } from "fs/promises"
import mysql from "mysql2/promise"
import { Client, type ConnectConfig } from "ssh2"
import type { Readable } from "stream"

const SQL_MUTATION_PATTERN = /\b(insert|update|delete|alter|drop|create|truncate|grant|revoke)\b/i
const MYSQL_QUERY_TIMEOUT_MS = 30_000

let sshClient: Client | null = null
let sshClientPromise: Promise<Client> | null = null

export class SqlQueryValidationError extends Error {
  statusCode: number

  constructor(message: string, statusCode = 400) {
    super(message)
    this.name = "SqlQueryValidationError"
    this.statusCode = statusCode
  }
}

interface SqlExecutionResult {
  rows: Record<string, unknown>[]
  rowCount: number
  command: string
}

interface SqlMutationResult extends SqlExecutionResult {
  affectedRows: number
  insertId: number | null
}

interface DatabaseConnectionResult {
  connected: boolean
  checkedAt: string
}

interface SshConfig {
  host: string
  port: number
  username: string
  privateKey: string
}

interface MysqlConfig {
  host: string
  port: number
  user: string
  password: string
  database: string
}

function getEnvValue(name: string) {
  const value = process.env[name]
  if (!value)
    throw new SqlQueryValidationError(`${name} is not configured`, 500)

  return value
}

function parsePort(value: string, envName: string) {
  const port = Number(value)
  if (!Number.isInteger(port) || port <= 0)
    throw new SqlQueryValidationError(`${envName} must be a valid positive integer`, 500)

  return port
}

async function getSshConfig(): Promise<SshConfig> {
  const keyPath = getEnvValue("SSH_KEY_PATH")
  const privateKey = await readFile(keyPath, "utf-8")

  return {
    host: getEnvValue("SSH_HOST"),
    port: parsePort(getEnvValue("SSH_PORT"), "SSH_PORT"),
    username: getEnvValue("SSH_USER"),
    privateKey,
  }
}

function getMysqlConfig(): MysqlConfig {
  return {
    host: getEnvValue("MYSQL_HOST"),
    port: parsePort(getEnvValue("MYSQL_PORT"), "MYSQL_PORT"),
    user: getEnvValue("MYSQL_USER"),
    password: getEnvValue("MYSQL_PASSWORD"),
    database: getEnvValue("MYSQL_DATABASE"),
  }
}

function createSshConnection(config: ConnectConfig): Promise<Client> {
  return new Promise((resolve, reject) => {
    const client = new Client()

    client
      .on("ready", () => resolve(client))
      .on("error", (error) => reject(error))
      .connect(config)
  })
}

async function getSshClient() {
  if (sshClient)
    return sshClient

  if (!sshClientPromise) {
    sshClientPromise = getSshConfig()
      .then((config) => createSshConnection(config))
      .then((client) => {
        client.on("close", () => {
          sshClient = null
          sshClientPromise = null
        })
        sshClient = client
        return client
      })
      .catch((error) => {
        sshClientPromise = null
        throw error
      })
  }

  return sshClientPromise
}

function openMysqlStreamOverSsh(client: Client, mysqlConfig: MysqlConfig): Promise<Readable> {
  return new Promise((resolve, reject) => {
    client.forwardOut(
      "127.0.0.1",
      0,
      mysqlConfig.host,
      mysqlConfig.port,
      (error, stream) => {
        if (error) {
          reject(error)
          return
        }

        resolve(stream)
      },
    )
  })
}

async function withMysqlConnection<T>(
  callback: (connection: mysql.Connection) => Promise<T>,
): Promise<T> {
  const mysqlConfig = getMysqlConfig()
  const client = await getSshClient()
  const stream = await openMysqlStreamOverSsh(client, mysqlConfig)

  const connection = await mysql.createConnection({
    user: mysqlConfig.user,
    password: mysqlConfig.password,
    database: mysqlConfig.database,
    stream,
  })

  try {
    return await callback(connection)
  } finally {
    await connection.end()
  }
}

function isMutationQuery(query: string) {
  return SQL_MUTATION_PATTERN.test(query)
}

export async function executeSqlQuery(
  query: string,
  params: unknown[] = [],
): Promise<SqlExecutionResult> {
  if (!query.trim())
    throw new SqlQueryValidationError("query is required")

  if (!Array.isArray(params))
    throw new SqlQueryValidationError("params must be an array")

  const allowMutations = process.env.ALLOW_SQL_MUTATIONS === "true"
  if (!allowMutations && isMutationQuery(query))
    throw new SqlQueryValidationError(
      "Mutating SQL statements are blocked. Set ALLOW_SQL_MUTATIONS=true to enable them.",
      403,
    )

  const result = await withMysqlConnection((connection) =>
    connection.query({
      sql: query,
      values: params,
      timeout: MYSQL_QUERY_TIMEOUT_MS,
    }),
  )

  const rows = Array.isArray(result[0]) ? result[0] : []

  return {
    rows: rows as Record<string, unknown>[],
    rowCount: rows.length,
    command: "QUERY",
  }
}

export async function executeSqlMutation(
  query: string,
  params: unknown[] = [],
): Promise<SqlMutationResult> {
  if (!query.trim())
    throw new SqlQueryValidationError("query is required")

  if (!Array.isArray(params))
    throw new SqlQueryValidationError("params must be an array")

  if (!isMutationQuery(query))
    throw new SqlQueryValidationError(
      "executeSqlMutation only accepts mutating SQL statements",
    )

  const result = await withMysqlConnection((connection) =>
    connection.query({
      sql: query,
      values: params,
      timeout: MYSQL_QUERY_TIMEOUT_MS,
    }),
  )

  const rows = Array.isArray(result[0]) ? result[0] : []
  const mutationMetadata = !Array.isArray(result[0]) && typeof result[0] === "object" && result[0] !== null
    ? result[0] as { affectedRows?: number; insertId?: number }
    : null

  return {
    rows: rows as Record<string, unknown>[],
    rowCount: rows.length,
    command: "QUERY",
    affectedRows: mutationMetadata?.affectedRows ?? 0,
    insertId: typeof mutationMetadata?.insertId === "number" && mutationMetadata.insertId > 0
      ? mutationMetadata.insertId
      : null,
  }
}

export async function testDatabaseConnection(): Promise<DatabaseConnectionResult> {
  await withMysqlConnection((connection) =>
    connection.query({
      sql: "SELECT 1",
      timeout: MYSQL_QUERY_TIMEOUT_MS,
    }),
  )

  return {
    connected: true,
    checkedAt: new Date().toISOString(),
  }
}
