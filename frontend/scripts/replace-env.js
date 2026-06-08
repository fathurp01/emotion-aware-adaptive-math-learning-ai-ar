const fs = require('fs');
const path = require('path');

const backendUrl = process.env.BACKEND_API_URL;
if (!backendUrl) {
  console.log('BACKEND_API_URL is not set, skipping env replacement.');
  process.exit(0);
}

console.log(`Replacing rewrite destination with: ${backendUrl}`);

const filesToUpdate = [
  path.join(__dirname, '../.next/required-server-files.json'),
  path.join(__dirname, '../.next/routes-manifest.json')
];

filesToUpdate.forEach(filePath => {
  if (fs.existsSync(filePath)) {
    try {
      let content = fs.readFileSync(filePath, 'utf8');
      // Replace http://localhost:5000 with the actual backend URL
      const updatedContent = content.replace(/http:\/\/localhost:5000/g, backendUrl);
      fs.writeFileSync(filePath, updatedContent, 'utf8');
      console.log(`Successfully updated: ${filePath}`);
    } catch (err) {
      console.error(`Error updating ${filePath}:`, err);
    }
  } else {
    console.log(`File not found: ${filePath}`);
  }
});
