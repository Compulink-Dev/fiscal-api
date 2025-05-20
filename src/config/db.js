const mongoose = require('mongoose');
const colors = require('colors');

const connectDB = async () => {
  try {
    if (!process.env.MONGODB_URI) {
      throw new Error('MONGODB_URI is not defined in environment variables');
    }

    const conn = await mongoose.connect(process.env.MONGODB_URI);


    console.log(`MongoDB Connected: ${conn.connection.host}`.cyan.underline.bold);
  } catch (err) {
    console.error(`Database connection error: ${err.message}`.red.bold);
    process.exit(1);
  }
};

module.exports = connectDB;