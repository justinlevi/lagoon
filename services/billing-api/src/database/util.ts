import { readFileSync, writeFile } from "fs";
import { resolve } from "path";

export const readData = () => {
  const data = JSON.parse(readFileSync(resolve(__dirname, './db.json'), 'utf-8'));
  return data;
}

export const writeData = (data: any) => {
  writeFile(resolve(__dirname, './db.json'), JSON.stringify(data, null, 4), (err) => {
    if (err) {  console.error(err);  return; };
    console.log("File has been created");
  });
}