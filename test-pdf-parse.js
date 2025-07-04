import fs from 'fs/promises';
import pdfParse from 'pdf-parse';

async function test() {
  const buffer = await fs.readFile('./uploads/Aarti_Drugs_Limited_3006418686.pdf');
  const data = await pdfParse(buffer);
  console.log(data.text.slice(0, 500)); // Print first 500 chars
}

test(); 