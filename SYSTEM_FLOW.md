# Bank Statement Analyzer - System Flow & Architecture

This document provides a complete overview of the Bank Statement Analyzer project, detailing the technologies used, their purpose, and the step-by-step flow of how the entire system works from end to end.

---

## 🛠️ Technologies Used

The project is divided into three main layers: **Frontend (UI)**, **Backend (Server & Database)**, and the **AI Pipeline (Processing)**.

### 1. Frontend (User Interface)
- **React.js & Vite**: Used to build a blazingly fast, modern Single Page Application (SPA).
- **Vanilla CSS (Glassmorphism)**: Used for premium, modern, and responsive styling.
- **Lucide-React**: Provides lightweight and beautiful SVG icons.
- **Fetch API**: Used to communicate with the backend for uploading files, polling status, and modifying data.

### 2. Backend (Server & Database)
- **Node.js & Express.js**: The core server framework that handles API routing, file uploads, and serves the built React frontend on port `5555`.
- **MongoDB & Mongoose**: A NoSQL database used to store extracted bank transactions and file hashes (to cache results and avoid re-processing the same PDF).
- **Multer**: Middleware used to handle multipart/form-data, specifically for securely saving uploaded PDF files to the local disk.
- **Child Process (`spawn`)**: Used by Node.js to trigger and communicate with the Python AI script in the background without freezing the server.

### 3. AI Pipeline (Core Processing Engine)
- **Python 3**: The language powering the AI logic.
- **PyMuPDF (`pymupdf`)**: High-performance library used to slice the multi-page PDF document into high-resolution images.
- **PyTorch & Hugging Face Transformers**: The deep learning framework used to load and run the **Qwen2-VL-2B-Instruct** Vision-Language Model.
- **Pandas & OpenPyXL**: Used to convert the extracted JSON data into formatted Excel (`.xlsx`) files.

---

## ⚙️ How the System Works (End-to-End Flow)

Here is the exact step-by-step journey of a bank statement from the moment the user clicks "Upload" to the final Excel export.

### Phase 1: Upload & Initialization
1. **User Action**: The user selects a PDF bank statement in the React UI and clicks **Process PDF**.
2. **Backend Reception**: The React app sends the file to the Express backend (`/api/process/upload`).
3. **File Caching**: The backend hashes the file. If it has processed this exact file before, it instantly returns the cached data from MongoDB. If it's new, it saves the PDF to the `/uploads` folder.
4. **Job Creation**: The backend generates a unique `Job ID`, responds to the frontend immediately with a `202 Accepted` status, and spawns the Python AI pipeline in the background.
5. **Real-Time Polling**: The frontend begins polling the backend (`/api/process/status/:jobId`) every 1 second to fetch real-time logs.

### Phase 2: AI Processing (The Heavy Lifting)
6. **PDF Conversion**: The Python script (`pipeline.py`) takes the PDF and uses PyMuPDF to convert every page into a crisp PNG image.
7. **Hardware Detection**: The script checks the computer's hardware.
   - If an NVIDIA GPU is found, it loads the Qwen AI model with hardware acceleration (allocating memory carefully to avoid crashes).
   - If no GPU is found (like on a 16GB laptop), it safely falls back to CPU processing using lightweight `float16` compression to prevent RAM crashes.
8. **Vision OCR Extraction**: The Qwen AI looks at each image, understands the layout of the bank statement, and extracts the date, description, debit, credit, and balance.
9. **Streaming Status**: While Python processes each page, it prints status updates (e.g., *"OCR on page 2..."*). The Node.js server captures these logs and forwards them to the React UI so the user knows the system isn't stuck.

### Phase 3: Data Storage & Presentation
10. **Data Output**: Once all pages are read, Python outputs a clean, structured JSON array of all transactions and gracefully shuts down.
11. **Database Save**: The Node.js server parses the JSON output and saves every single transaction row into MongoDB.
12. **UI Update**: The frontend's polling interval detects that the job is complete. It stops polling, hides the loading spinner, and displays the transactions in a beautiful, interactive data table.

### Phase 4: User Customization & Export
13. **Data Modification**: The user can review the data in the React table. If the AI made a slight mistake, or if a manual entry is needed, the user can click **Edit**, **Delete**, or **Add Record**. These changes are instantly saved to MongoDB via the Express API.
14. **Excel Export**: When satisfied, the user clicks **Export Excel**. The backend queries MongoDB, formats the data to perfectly match the user's *01 MasterFile Bookkeeping* template, and sends the `.xlsx` file back to the browser for download.

---

## 🚀 Key Optimizations Built-In
- **Asynchronous Processing**: The server never freezes. It uses background processes and real-time polling to keep the UI smooth and responsive.
- **Hardware-Aware AI**: The AI automatically scales its memory usage depending on whether it is running on a high-end 64GB workstation or a standard 16GB laptop.
- **Smart Caching**: Uploading the same PDF twice takes 0.1 seconds instead of 10 minutes because the system remembers the file signature.
