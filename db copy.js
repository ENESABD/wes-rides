const {Pool} = require('pg');

const pool = new Pool({
  host: "localhost",
  user: "postgres",
  password: "mahmud11",
  port: 5432,
  database: "wesrides1"
});

module.exports = pool;