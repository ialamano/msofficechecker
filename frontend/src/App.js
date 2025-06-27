import React, { useState } from 'react';

function App() {
    const [selectedFile, setSelectedFile] = useState(null);
    const [outputFileUrl, setOutputFileUrl] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [issues, setIssues] = useState([]);
    const [fileName, setFileName] = useState(''); // To store the original file name
    const [fileType, setFileType] = useState(''); // To store the file type for the backend

    // Function to handle file selection
    const handleFileChange = (event) => {
        const file = event.target.files[0];
        if (file) {
            setSelectedFile(file);
            setFileName(file.name);
            const type = file.name.split('.').pop().toLowerCase();
            setFileType(type);
            setError(''); // Clear previous errors
            setOutputFileUrl(''); // Clear previous report URL
            setIssues([]); // Clear previous issues
        } else {
            setSelectedFile(null);
            setFileName('');
            setFileType('');
        }
    };

    // Function to handle report generation
    const handleGenerateReport = async () => {
        if (!selectedFile) {
            setError('Please select a file first.');
            return;
        }

        setLoading(true);
        setError('');
        setOutputFileUrl('');
        setIssues([]);

        const reader = new FileReader();
        reader.readAsDataURL(selectedFile); // Read file as Base64

        reader.onloadend = async () => {
            const base64String = reader.result.split(',')[1]; // Extract Base64 part

            try {
                // Ensure REACT_APP_API_URL is defined. Netlify injects this.
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
                        filename: fileName,
                        file_type: fileType,
                    }),
                });

                const data = await response.json();

                if (data.success) {
                    setOutputFileUrl(`data:application/vnd.openxmlformats-officedocument.${fileType}+xml;base64,${data.output_file_base64}`);
                    setIssues(data.issues_found);
                } else {
                    setError(data.error || 'An unexpected error occurred during report generation.');
                }
            } catch (err) {
                console.error("Error generating report:", err);
                setError(`An unexpected error occurred: ${err.message}. Please try again.`);
            } finally {
                setLoading(false);
            }
        };

        reader.onerror = () => {
            setLoading(false);
            setError('Failed to read file.');
        };
    };

    // Function to handle downloading the generated report
    const handleDownloadReport = () => {
        if (outputFileUrl) {
            const link = document.createElement('a');
            link.href = outputFileUrl;
            // Determine a suitable filename for download
            let downloadFileName = 'compatibility_report';
            if (fileName) {
                // Remove original extension and add '.docx', '.pptx', or '.xlsx'
                const nameWithoutExt = fileName.substring(0, fileName.lastIndexOf('.')) || fileName;
                downloadFileName = `${nameWithoutExt}_compatibility.${fileType}`;
            } else {
                downloadFileName = `compatibility_report.${fileType}`;
            }
            link.download = downloadFileName;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex flex-col items-center justify-center p-4 font-inter">
            <div className="bg-white p-8 rounded-xl shadow-2xl w-full max-w-4xl border border-blue-200">
                <h1 className="text-4xl font-extrabold text-gray-800 mb-6 text-center">
                    Office File Compatibility Checker
                </h1>
                <p className="text-center text-gray-600 mb-8">
                    Upload your .docx, .pptx, or .xlsx file to check for compatibility issues when converting to Google Docs, Slides, or Sheets.
                </p>

                {/* File Input */}
                <div className="mb-6 flex flex-col sm:flex-row items-center justify-center space-y-4 sm:space-y-0 sm:space-x-4">
                    <input
                        type="file"
                        onChange={handleFileChange}
                        accept=".docx,.pptx,.xlsx,.xlsm"
                        className="block w-full text-sm text-gray-700
                                   file:mr-4 file:py-2 file:px-4
                                   file:rounded-full file:border-0
                                   file:text-sm file:font-semibold
                                   file:bg-indigo-50 file:text-indigo-700
                                   hover:file:bg-indigo-100 cursor-pointer rounded-lg border border-gray-300 p-2"
                    />
                    {selectedFile && (
                        <span className="text-gray-600 text-sm mt-2 sm:mt-0">
                            Selected: {selectedFile.name}
                        </span>
                    )}
                </div>

                {/* Action Buttons */}
                <div className="flex flex-col sm:flex-row justify-center items-center space-y-4 sm:space-y-0 sm:space-x-4 mb-8">
                    <button
                        onClick={handleGenerateReport}
                        disabled={!selectedFile || loading}
                        className={`px-8 py-3 rounded-full text-lg font-bold transition-all duration-300
                                    ${!selectedFile || loading
                                        ? 'bg-gray-300 text-gray-600 cursor-not-allowed'
                                        : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-md hover:shadow-lg transform hover:-translate-y-0.5'
                                    }`}
                    >
                        {loading ? 'Generating...' : 'Generate Compatibility Report'}
                    </button>

                    {outputFileUrl && (
                        <button
                            onClick={handleDownloadReport}
                            className={`px-8 py-3 rounded-full text-lg font-bold transition-all duration-300
                                        bg-green-500 text-white hover:bg-green-600 shadow-md hover:shadow-lg transform hover:-translate-y-0.5`}
                        >
                            Download Report
                        </button>
                    )}
                </div>

                {/* Loading / Error Messages */}
                {loading && (
                    <div className="text-center text-indigo-600 font-medium text-lg mb-4">
                        Processing your file, please wait...
                    </div>
                )}

                {error && (
                    <div className="bg-red-100 border border-red-400 text-red-700 px-6 py-4 rounded-lg mb-4 text-center">
                        <p className="font-bold">Error:</p>
                        <p>{error}</p>
                    </div>
                )}

                {/* Display Report Link and Issues */}
                {outputFileUrl && !loading && !error && (
                    <div className="mt-8 p-6 bg-blue-50 border border-blue-200 rounded-xl shadow-inner">
                        <h2 className="text-2xl font-semibold text-gray-700 mb-4 text-center">Compatibility Report Generated!</h2>

                        {issues.length > 0 ? (
                            <>
                                <h3 className="text-xl font-medium text-red-600 mb-3">
                                    <span className="inline-block mr-2">⚠️</span> Potential Issues:
                                </h3>
                                <ul className="list-disc list-inside text-gray-700 mb-4 space-y-2">
                                    {issues.map((issue, index) => (
                                        <li key={index} className="bg-red-50 p-2 rounded-md border border-red-100">
                                            {issue}
                                        </li>
                                    ))}
                                </ul>
                            </>
                        ) : (
                            <p className="text-lg text-green-700 font-medium text-center mb-4">
                                🎉 No major compatibility issues detected.
                                Always perform a manual review after conversion to Google Docs/Slides/Sheets.
                            </p>
                        )}

                        <p className="text-center text-gray-600 mt-4">
                            Click the "Download Report" button above to save the generated compatibility report.
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}

export default App;
