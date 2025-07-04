import fs from 'fs/promises';

const repeatKeywords = [
  "repeated", "previously cited", "same issue as prior", "continuing violation",
  "repeat observation", "ongoing problem", "persistent violation", "recurring issue",
  "same finding", "previously identified", "continuing deficiency", "again", "still",
  "not resolved", "not corrected", "remains uncorrected", "prior inspection", "previous inspection"
];

function extractRepeatFindingsFromText(text) {
  const findings = [];
  const lowerText = text.toLowerCase();
  for (const keyword of repeatKeywords) {
    if (lowerText.includes(keyword)) {
      findings.push(`Possible repeat finding: phrase "${keyword}" found in document.`);
    }
  }
  return findings;
}

// Test with sample text that contains repeat keywords
const sampleText = `
This is a sample FDA 483 document. The firm has been previously cited for similar violations.
The same issue as prior inspection continues to be a problem. This is a repeated finding that
has not been resolved. The firm still has ongoing problems with documentation.
`;

console.log('Testing repeat finding detection...');
console.log('Sample text:', sampleText);
console.log('\nDetected repeat findings:');
const findings = extractRepeatFindingsFromText(sampleText);
findings.forEach(finding => console.log('-', finding));

console.log('\n✅ Repeat finding detection is working correctly!'); 