const { Sequelize } = require('sequelize');
require('dotenv').config();

const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASS,
  {
    host: process.env.DB_HOST,
    dialect: 'mysql',
    logging: false,
    pool: {
      max: 5,
      min: 0,
      acquire: 30000,
      idle: 10000
    }
  }
);

const connectDB = async () => {
  try {
    await sequelize.authenticate();
    console.log('✅ MySQL connected successfully via Sequelize');
    
    // Sync models
    await sequelize.sync({ alter: true });
    console.log('✅ Database models synced');
  } catch (err) {
    console.error('❌ MySQL connection error:', err.message);
    // Don't exit process here, maybe MySQL isn't running yet
  }
};

module.exports = { sequelize, connectDB };
