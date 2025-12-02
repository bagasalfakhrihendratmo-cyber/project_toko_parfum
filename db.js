const mysql = require('mysql2')

const dbPool = mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: 'root',
    database: 'Parfum_db',
})

module.exports = {dbPool}