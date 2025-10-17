import mongoose from "mongoose";

export const connectDB = async () => {
  try {
    mongoose.connection.on("connected", () =>
      console.log("✅ Database connected")
    );
    mongoose.connection.on("error", (err) =>
      console.log("❌ DB connection error:", err)
    );

    await mongoose.connect(`${process.env.MONGODB_URI}/chatApplication`);
  } catch (error) {
    console.log(error);
  }
};
