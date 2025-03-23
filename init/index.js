const mongoose = require("mongoose");
const initData = require("./data.js");
const Listing = require("../models/listing.js");


const MONGO_URL = "mongodb://127.0.0.1:27017/wanderlust";

main()
  .then(() => {
    console.log("connected to DB");
  })
  .catch((err) => {
    console.log(err);
  });

async function main() {
  await mongoose.connect(MONGO_URL);
}

const initDB = async () => {
  await Listing.deleteMany({});
  initData.data = initData.data.map((obj) => ({
    ...obj,
    owner: "673306aff91d3343c0d9c653",
    image: typeof obj.image === "object" && obj.image.url && obj.image.filename
      ? obj.image  // If `image` is already correctly structured
      : { url: "default-url.jpg", filename: "default.jpg" },  // Default object if not provided
  }));
  await Listing.insertMany(initData.data);
  console.log("data was initialized");
};

initDB();