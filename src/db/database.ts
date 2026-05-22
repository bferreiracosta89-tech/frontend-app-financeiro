import { Platform } from "react-native";

let database: any;

if (Platform.OS === "web") {
  database = require("./database.web");
} else {
  database = require("./database.native");
}

export const initDatabase = database.initDatabase;
export const getDb = database.getDb;
export const wipeAll = database.wipeAll;
