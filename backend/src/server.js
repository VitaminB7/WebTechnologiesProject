require('dotenv').config({ path: require('path').join(__dirname, '..', '.env'), quiet: true });

const { ensureDatabase } = require('./config/ensure-database');

const port = Number(process.env.PORT) || 3000;

ensureDatabase()
  .then(() => {
    // Required only now: the MySQL pool reads DB_* from process.env when it is first loaded.
    const app = require('./app');
    app.listen(port, () => {
      console.log(`AURA Sukhumvit 36 running at http://localhost:${port}`);
    });
  })
  .catch((err) => {
    console.error('Could not prepare the database:', err.message);
    process.exitCode = 1;
  });
