import mysql from "mysql2/promise";

/**
 * MySQL holds the structured, transactional data: users, departments, categories,
 * FAQs, document metadata, feedback, bookmarks and search history.
 *
 * Configure with MYSQL_URL (mysql://user:password@host:3306/CampusQuery).
 */
const url = process.env.MYSQL_URL;
if (!url) {
  throw new Error("MYSQL_URL must be set, e.g. mysql://user:password@localhost:3306/CampusQuery");
}

export const mysqlPool = mysql.createPool({
  uri: url,
  waitForConnections: true,
  connectionLimit: 10,
  timezone: "Z",
});

// TIMESTAMP values are converted using the session time zone; pin it to UTC so
// the "Z" parsing above is always correct.
mysqlPool.pool.on("connection", (connection) => {
  connection.query("SET time_zone = '+00:00'");
});
