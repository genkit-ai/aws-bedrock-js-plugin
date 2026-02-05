# Document/Data Content Type Support

The AWS Bedrock plugin now supports sending documents (CSV, PDF, DOCX, etc.) to models using the `data` content type.

## Usage

You can now include documents in your prompts using the `data` field in message parts:

```typescript
import { genkit } from 'genkit';
import { awsBedrock, amazonNovaProV1 } from "genkitx-aws-bedrock";

const ai = genkit({
  plugins: [awsBedrock()],
  model: amazonNovaProV1(),
});

// Example: Sending a CSV document
const response = await ai.generate({
  prompt: [
    { text: "Please analyze this CSV file:" },
    {
      data: {
        mimeType: 'text/csv',
        fileName: 'sales-data.csv',
        content: 'data:text/csv;base64,TmFtZSxBZ2UKSm9obiwzMAo...' // Base64 encoded content
      }
    }
  ]
});

// Example: Sending a PDF document
const pdfResponse = await ai.generate({
  prompt: [
    { text: "Summarize this document:" },
    {
      data: {
        mimeType: 'application/pdf',
        fileName: 'report.pdf',
        content: 'data:application/pdf;base64,JVBERi0xLjQKJeLjz9MKMSAw...' // Base64 encoded content
      }
    }
  ]
});
```

## Supported Document Formats

The following MIME types are supported and mapped to AWS Bedrock DocumentFormat:

- **CSV**: `text/csv` → `csv`
- **PDF**: `application/pdf` → `pdf`
- **HTML**: `text/html` → `html`
- **Markdown**: `text/markdown`, `text/md` → `md`
- **Word Documents**: 
  - `application/msword` → `doc`
  - `application/vnd.openxmlformats-officedocument.wordprocessingml.document` → `docx`
- **Excel Spreadsheets**:
  - `application/vnd.ms-excel` → `xls`
  - `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` → `xlsx`
- **Plain Text**: `text/plain` → `txt`

Any other `text/*` MIME type will default to `txt` format.

## Data Field Structure

The `data` field should contain an object with the following properties:

- **`mimeType`** (required): The MIME type of the document
- **`content`** (required): The document content as a base64-encoded data URL (e.g., `data:text/csv;base64,<base64-data>`)
- **`fileName`** (optional): A descriptive name for the document (defaults to "document")

## Example with File Reading

```typescript
import { readFileSync } from 'fs';
import { genkit } from 'genkit';
import { awsBedrock, amazonNovaProV1 } from "genkitx-aws-bedrock";

const ai = genkit({
  plugins: [awsBedrock()],
  model: amazonNovaProV1(),
});

// Read a file and convert to base64
const fileContent = readFileSync('./data/example.csv');
const base64Content = fileContent.toString('base64');

const response = await ai.generate({
  prompt: [
    { text: "Analyze the data in this file:" },
    {
      data: {
        mimeType: 'text/csv',
        fileName: 'example.csv',
        content: `data:text/csv;base64,${base64Content}`
      }
    }
  ]
});

console.log(response.text);
```

## Notes

- Make sure the model you're using supports document inputs. Refer to AWS Bedrock documentation for model capabilities.
- The document content must be provided as a base64-encoded data URL.
- Large documents may have size limitations depending on the model being used.
