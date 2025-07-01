import React, { useState } from 'react';

function App() {
    const [selectedFiles, setSelectedFiles] = useState([]); // Array to hold multiple selected files
    const [processing, setProcessing] = useState(false); // Overall processing state
    const [globalError, setGlobalError] = useState(''); // General error for the whole process
    // Array to store results for each processed file:
    // { id, originalFileName, originalFileType, outputBase64, issuesFound, status, error }
    const [reports, setReports] = useState([]);
    const [allReportsGenerated, setAllReportsGenerated] = useState(false); // New state for "Download All" button

    // Function to handle file selection (now supports multiple)
    const handleFileChange = (event) => {
        const files = Array.from(event.target.files); // Convert FileList to Array
        setSelectedFiles(files);
        setGlobalError(''); // Clear previous global errors
        setReports([]); // Clear previous reports
        setAllReportsGenerated(false); // Reset download all state
    };

    // Function to handle report generation for all selected files
    const handleGenerateReports = async () => {
        if (selectedFiles.length === 0) {
            setGlobalError('Please select at least one file first.');
            return;
        }

        setProcessing(true);
        setGlobalError('');
        setReports([]); // Clear previous reports before starting new processing
        setAllReportsGenerated(false); // Reset download all state

        const newReports = [];
        let allSucceeded = true; // Flag to track if all reports generated successfully

        for (let i = 0; i < selectedFiles.length; i++) {
            const file = selectedFiles[i];
            const fileId = i; // Simple ID for tracking
            const originalFileName = file.name;
            const originalFileType = originalFileName.split('.').pop().toLowerCase();

            // Initialize report status for current file
            newReports[fileId] = {
                id: fileId,
                originalFileName,
                originalFileType,
                status: 'Processing...',
                outputBase64: '',
                issuesFound: [],
                error: ''
            };
            setReports([...newReports]); // Update UI with processing status

            const reader = new FileReader();
            const readPromise = new Promise((resolve, reject) => {
                reader.onloadend = () => resolve(reader.result);
                reader.onerror = () => reject(new Error('Failed to read file.'));
                reader.readAsDataURL(file);
            });

            try {
                const base64StringWithPrefix = await readPromise;
                const base64String = base64StringWithPrefix.split(',')[1]; // Extract Base64 part

                const apiUrl = process.env.REACT_APP_API_URL;
                if (!apiUrl) {
                    throw new Error('Backend API URL is not configured. Please check environment variables.');
                }

                const response = await fetch(`${apiUrl}/check-compatibility`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        file_base64: base64String,
                        filename: originalFileName,
                        file_type: originalFileType,
                    }),
                });

                const data = await response.json();

                if (data.success) {
                    newReports[fileId] = {
                        ...newReports[fileId],
                        status: 'Generated',
                        outputBase64: data.output_file_base64,
                        issuesFound: data.issues_found,
                        error: ''
                    };
                } else {
                    newReports[fileId] = {
                        ...newReports[fileId],
                        status: 'Error',
                        error: data.error || 'An unexpected error occurred during report generation.'
                    };
                    allSucceeded = false; // Mark that at least one failed
                }
            } catch (err) {
                console.error(`Error processing ${originalFileName}:`, err);
                newReports[fileId] = {
                    ...newReports[fileId],
                    status: 'Error',
                    error: `An unexpected error occurred: ${err.message}.`
                };
                allSucceeded = false; // Mark that at least one failed
            }
            setReports([...newReports]); // Update UI after each file is processed
        }
        setProcessing(false);
        setAllReportsGenerated(allSucceeded && newReports.length > 0); // Enable "Download All" if all succeeded
    };

    // Function to handle downloading a specific generated report
    const handleDownloadReport = (outputBase64, originalFileName, originalFileType) => {
        if (outputBase64) {
            const link = document.createElement('a');
            // Construct the data URL based on the file type
            let mimeType;
            switch (originalFileType) {
                case 'docx':
                    mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
                    break;
                case 'pptx':
                    mimeType = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
                    break;
                case 'xlsx':
                case 'xlsm':
                    mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
                    break;
                default:
                    mimeType = 'application/octet-stream'; // Generic binary
            }

            link.href = `data:${mimeType};base64,${outputBase64}`;

            // Determine a suitable filename for download
            const nameWithoutExt = originalFileName.substring(0, originalFileName.lastIndexOf('.')) || originalFileName;
            link.download = `${nameWithoutExt}_compatibility_report.${originalFileType}`;

            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
    };

    // New function to download all generated reports
    const handleDownloadAllReports = () => {
        // Introduce a slight delay between downloads to prevent browser blocking
        reports.forEach((report, index) => {
            if (report.status === 'Generated' && report.outputBase64) {
                setTimeout(() => {
                    handleDownloadReport(report.outputBase64, report.originalFileName, report.originalFileType);
                }, index * 500); // 500ms delay for each subsequent download
            }
        });
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex flex-col items-center justify-center p-4 font-inter">
            <div className="bg-white p-8 rounded-xl shadow-2xl w-full max-w-4xl border border-blue-200">
                <h1 className="text-4xl font-extrabold text-gray-800 mb-6 text-center">
                    Office File Compatibility Checker
                </h1>
                <p className="text-center text-gray-600 mb-8">
                    Upload your .docx, .pptx, or .xlsx files to check for compatibility issues when converting to Google Docs, Slides, or Sheets.
                </p>

                {/* File Input */}
                <div className="mb-6 flex flex-col sm:flex-row items-center justify-center space-y-4 sm:space-y-0 sm:space-x-4">
                    <input
                        type="file"
                        onChange={handleFileChange}
                        accept=".docx,.pptx,.xlsx,.xlsm"
                        multiple // Allow multiple file selection
                        className="block w-full text-sm text-gray-700
                                   file:mr-4 file:py-2 file:px-4
                                   file:rounded-full file:border-0
                                   file:text-sm file:font-semibold
                                   file:bg-indigo-50 file:text-indigo-700
                                   hover:file:bg-indigo-100 cursor-pointer rounded-lg border border-gray-300 p-2"
                    />
                </div>

                {/* Display selected files */}
                {selectedFiles.length > 0 && (
                    <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
                        <h3 className="text-lg font-semibold text-gray-700 mb-2">Selected Files:</h3>
                        <ul className="list-disc list-inside text-gray-600">
                            {selectedFiles.map((file, index) => (
                                <li key={index}>{file.name}</li>
                            ))}
                        </ul>
                    </div>
                )}

                {/* Action Buttons */}
                <div className="flex flex-col sm:flex-row justify-center items-center space-y-4 sm:space-y-0 sm:space-x-4 mb-8">
                    <button
                        onClick={handleGenerateReports}
                        disabled={selectedFiles.length === 0 || processing}
                        className={`px-8 py-3 rounded-full text-lg font-bold transition-all duration-300
                                    ${selectedFiles.length === 0 || processing
                                        ? 'bg-gray-300 text-gray-600 cursor-not-allowed'
                                        : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-md hover:shadow-lg transform hover:-translate-y-0.5'
                                    }`}
                    >
                        {processing ? 'Processing All Files...' : 'Generate Compatibility Reports'}
                    </button>

                    {/* New "Download All Reports" button */}
                    {allReportsGenerated && selectedFiles.length > 0 && (
                        <button
                            onClick={handleDownloadAllReports}
                            className={`px-8 py-3 rounded-full text-lg font-bold transition-all duration-300
                                        bg-purple-600 text-white hover:bg-purple-700 shadow-md hover:shadow-lg transform hover:-translate-y-0.5`}
                        >
                            Download All Reports
                        </button>
                    )}
                </div>

                {/* Global Loading / Error Messages */}
                {processing && (
                    <div className="text-center text-indigo-600 font-medium text-lg mb-4">
                        Processing your files, please wait...
                    </div>
                )}

                {globalError && (
                    <div className="bg-red-100 border border-red-400 text-red-700 px-6 py-4 rounded-lg mb-4 text-center">
                        <p className="font-bold">Error:</p>
                        <p>{globalError}</p>
                    </div>
                )}

                {/* Display Individual Reports */}
                {reports.length > 0 && !processing && (
                    <div className="mt-8 space-y-6">
                        <h2 className="text-3xl font-bold text-gray-800 text-center mb-6">Generated Reports</h2>
                        {reports.map((report) => (
                            <div key={report.id} className="p-6 bg-blue-50 border border-blue-200 rounded-xl shadow-inner">
                                <h3 className="text-xl font-semibold text-gray-700 mb-3">
                                    Report for: <span className="text-indigo-700">{report.originalFileName}</span>
                                </h3>

                                {report.status === 'Error' && (
                                    <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg mb-4">
                                        <p className="font-bold">Error processing this file:</p>
                                        <p>{report.error}</p>
                                    </div>
                                )}

                                {report.status === 'Generated' && (
                                    <>
                                        {report.issuesFound.length > 0 ? (
                                            <>
                                                <h4 className="text-lg font-medium text-red-600 mb-2">
                                                    <span className="inline-block mr-2">⚠️</span> Potential Issues:
                                                </h4>
                                                <ul className="list-disc list-inside text-gray-700 mb-4 space-y-1">
                                                    {report.issuesFound.map((issue, idx) => (
                                                        <li key={idx} className="bg-red-50 p-2 rounded-md border border-red-100">
                                                            {issue}
                                                        </li>
                                                    ))}
                                                </ul>
                                            </>
                                        ) : (
                                            <p className="text-md text-green-700 font-medium text-center mb-4">
                                                🎉 No major compatibility issues detected for this file.
                                                Always perform a manual review after conversion.
                                            </p>
                                        )}

                                        <div className="flex justify-center mt-4">
                                            <button
                                                onClick={() => handleDownloadReport(report.outputBase64, report.originalFileName, report.originalFileType)}
                                                className={`px-6 py-2 rounded-full text-md font-bold transition-all duration-300
                                                            bg-green-500 text-white hover:bg-green-600 shadow-md hover:shadow-lg transform hover:-translate-y-0.5`}
                                            >
                                                Download Report for {report.originalFileName}
                                            </button>
                                        </div>
                                    </>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

export default App;
