// Implementação web temporária.
// SQLite nativo funciona em Android/iOS via database.native.ts.

export const initDatabase = async (): Promise<void> => {
  console.log("WEB DATABASE DISABLED");
};

export const getDb = async (): Promise<any> => {
  throw new Error("SQLite não está disponível no Web. Use o frontend-web com backend/API ou teste no app Android/iOS.");
};

export const wipeAll = async (): Promise<void> => {
  console.log("WEB WIPE DISABLED");
};
