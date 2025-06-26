import React, { useState, useRef } from 'react';

function App() {
    const [selectedFile, setSelectedFile] = useState(null);
    const [outputFileName, setOutputFileName] = useState('compatibility_report.zip'); // Default to zip or generic, user will download specific type
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState('');
    const [downloadUrl, setDownloadUrl] = useState('');
    const [issues, setIssues] = useState([]);
    const fileInputRef = useRef(null);

    // Determines file type based on extension
    const getFileType = (filename) => {
        const ext = filename.split('.').pop().toLowerCase();
        if (ext === 'docx') return 'docx';
        if (ext === 'pptx') return 'pptx';
        if (ext === 'xlsx' || ext === 'xlsm') return 'xlsx'; // Treat xlsm as xlsx for compatibility check type
        return null;
    };

    // Determines the appropriate output MIME type and suggested extension
    const getOutputMimeTypeAndExtension = (fileType) => {
        if (fileType === 'docx') {
            return { mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', ext: 'docx' };
        }
        if (fileType === 'pptx') {
            return { mime: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', ext: 'pptx' };
        }
        if (fileType === 'xlsx' || fileType === 'xlsm') {
            return { mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', ext: 'xlsx' };
        }
        return { mime: 'application/octet-stream', ext: 'bin' }; // Fallback
    };

    // Handles file selection from the input.
    const handleFileChange = (event) => {
        const file = event.target.files[0];
        if (file) {
            const type = getFileType(file.name);
            if (type) {
                setSelectedFile(file);
                const { ext } = getOutputMimeTypeAndExtension(type);
                // Suggest an output filename based on the input file and its type
                const baseName = file.name.split('.').slice(0, -1).join('.');
                setOutputFileName(`compatibility_report_${baseName}.${ext}`);
                // Clear previous messages and results.
                setMessage('');
                setDownloadUrl('');
                setIssues([]);
            } else {
                setSelectedFile(null);
                setMessage('Please select a supported file type (.docx, .pptx, .xlsx, .xlsm).');
            }
        }
    };

    // Triggered when the "Generate Report" button is clicked.
    const handleGenerateReport = async () => {
        if (!selectedFile) {
            setMessage('Please select a file first.');
            return;
        }

        setLoading(true);
        setMessage('Processing document... This may take a moment.');
        setDownloadUrl('');
        setIssues([]);

        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const arrayBuffer = e.target.result;
                const base64String = btoa(
                    new Uint8Array(arrayBuffer)
                        .reduce((data, byte) => data + String.fromCharCode(byte), '')
                );

                const fileType = getFileType(selectedFile.name);
                if (!fileType) {
                    setMessage('Error: Could not determine file type for processing.');
                    setLoading(false);
                    return;
                }

                // --- API Call to Unified Backend ---
                // IMPORTANT: Replace 'YOUR_DEPLOYED_BACKEND_URL' with the actual URL of your deployed Flask backend.
                // For local testing: 'http://127.0.0.1:5000' or 'http://YOUR_LOCAL_IP_ADDRESS:5000'
                const backendApiUrl = `${process.env.REACT_APP_API_URL}/check-compatibility`; // Adjust for deployment

                const fetchResponse = await fetch(backendApiUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        file_base64: base64String,
                        filename: selectedFile.name,
                        file_type: fileType, // Pass the detected file type to the backend
                    }),
                });

                if (!fetchResponse.ok) {
                    const errorData = await fetchResponse.json().catch(() => ({}));
                    throw new Error(errorData.error || `Backend processing failed with status: ${fetchResponse.status}`);
                }

                const response = await fetchResponse.json();

                if (response.success) {
                    const outputBase64 = response.output_file_base64;
                    const detectedIssues = response.issues_found;

                    if (outputBase64) {
                        const { mime, ext } = getOutputMimeTypeAndExtension(fileType);
                        const blob = b64toBlob(outputBase64, mime);
                        const url = URL.createObjectURL(blob);
                        setDownloadUrl(url);
                        // Update output filename to reflect the correct extension for download
                        const baseName = selectedFile.name.split('.').slice(0, -1).join('.');
                        setOutputFileName(`compatibility_report_${baseName}.${ext}`);

                        setMessage('Compatibility report generated successfully!');
                        setIssues(detectedIssues);
                    } else {
                        setMessage('Failed to generate report: Output file data not received.');
                    }
                } else {
                    setMessage(`Error: ${response.error || 'Unknown error from backend.'}`);
                }
            } catch (error) {
                console.error("Error during report generation:", error);
                setMessage(`An unexpected error occurred: ${error.message}. Please try again.`);
            } finally {
                setLoading(false);
            }
        };
        reader.onerror = (error) => {
            console.error("FileReader error:", error);
            setMessage(`Error reading file: ${error.message}`);
            setLoading(false);
        };
        reader.readAsArrayBuffer(selectedFile);
    };

    const b64toBlob = (b64Data, contentType = '', sliceSize = 512) => {
        const byteCharacters = atob(b64Data);
        const byteArrays = [];

        for (let offset = 0; offset < byteCharacters.length; offset += sliceSize) {
            const slice = byteCharacters.slice(offset, offset + sliceSize);
            const byteNumbers = new Array(slice.length);
            for (let i = 0; i < slice.length; i++) {
                byteNumbers[i] = slice.charCodeAt(i);
            }
            const byteArray = new Uint8Array(byteNumbers);
            byteArrays.push(byteArray);
        }
        return new Blob(byteArrays, { type: contentType });
    };

    return (
        <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4 font-sans">
            <div className="bg-white p-8 rounded-lg shadow-xl w-full max-w-lg">
                <h1 className="text-3xl font-bold text-gray-800 mb-6 text-center">
                    Office File Compatibility Checker
                </h1>

                <p className="text-gray-600 mb-6 text-center">
                    Upload your Microsoft Office file (.docx, .pptx, .xlsx, .xlsm) to check for
                    features that might cause inconsistencies when converted to Google Docs/Slides/Sheets.
                    A new compatible report file will be generated.
                </p>

                <div className="mb-6">
                    <label htmlFor="file-upload" className="block text-gray-700 text-sm font-semibold mb-2">
                        Select Office File:
                    </label>
                    <input
                        id="file-upload"
                        type="file"
                        accept=".docx,.pptx,.xlsx,.xlsm" // Accept all supported file types
                        onChange={handleFileChange}
                        ref={fileInputRef}
                        className="block w-full text-sm text-gray-900 border border-gray-300 rounded-lg cursor-pointer bg-gray-50 focus:outline-none file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                    />
                    {selectedFile && (
                        <p className="mt-2 text-sm text-gray-500">Selected: <span className="font-medium text-gray-700">{selectedFile.name}</span></p>
                    )}
                </div>

                <div className="mb-6">
                    <label htmlFor="output-name" className="block text-gray-700 text-sm font-semibold mb-2">
                        Output Report File Name:
                    </label>
                    <input
                        id="output-name"
                        type="text"
                        value={outputFileName}
                        onChange={(e) => setOutputFileName(e.target.value)}
                        className="shadow-sm appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition duration-200"
                        placeholder="e.g., compatibility_report.docx"
                    />
                </div>

                <button
                    onClick={handleGenerateReport}
                    disabled={!selectedFile || loading}
                    className={`w-full py-3 px-4 rounded-lg text-white font-semibold transition duration-300 ${
                        !selectedFile || loading
                            ? 'bg-blue-400 cursor-not-allowed'
                            : 'bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-75 shadow-md'
                    }`}
                >
                    {loading ? (
                        <div className="flex items-center justify-center">
                            <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Generating Report...
                        </div>
                    ) : (
                        'Generate Compatibility Report'
                    )}
                </button>

                {message && (
                    <p className={`mt-4 text-center ${downloadUrl ? 'text-green-600' : 'text-red-600'} font-medium`}>
                        {message}
                    </p>
                )}

                {issues.length > 0 && (
                    <div className="mt-6 bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded-md">
                        <p className="font-semibold text-yellow-800 mb-2">Detected Potential Issues:</p>
                        <ul className="list-disc list-inside text-yellow-700 text-sm">
                            {issues.map((issue, index) => (
                                <li key={index}>{issue}</li>
                            ))}
                        </ul>
                    </div>
                )}

                {downloadUrl && (
                    <div className="mt-6 text-center">
                        <a
                            href={downloadUrl}
                            download={outputFileName}
                            className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-lg shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition duration-300"
                        >
                            <svg className="-ml-1 mr-3 h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                                <path fillRule="evenodd" d="M10 18a.75.75 0 01-.75-.75V5.612L5.29 9.79a.75.75 0 11-1.08-1.04l5.25-5.5a.75.75 0 011.08 0l5.25 5.5a.75.75 0 11-1.08 1.04l-3.96-4.178V17.25c0 .414-.336.75-.75.75z" clipRule="evenodd" />
                            </svg>
                            Download Report
                        </a>
                    </div>
                )}
            </div>
        </div>
    );
}

export default App;
