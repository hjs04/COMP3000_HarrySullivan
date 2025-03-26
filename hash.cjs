// This file is used to manually hash passwords
// when the program fails, causing database issues.
// The output can be manually added to the database
// using DBBrowser for SQLite or similar software.

const bcrypt = require('bcryptjs');
bcrypt.hash('test', 10, (err, hash) => {
  if (err) throw err;
  console.log('New hash for "admin":', hash);
});