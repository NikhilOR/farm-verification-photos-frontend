"use client";

import { Info } from "lucide-react";

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50 flex flex-col relative">
      {/* Watermark Background */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden opacity-[0.03] z-0">
        {[10, 30, 50, 70, 90].map((top, idx) => (
          <div
            key={idx}
            className="absolute text-[120px] font-bold text-gray-400 transform -rotate-45 whitespace-nowrap"
            style={{
              top: `${top}%`,
              left: idx % 2 === 0 ? "-5%" : "auto",
              right: idx % 2 === 1 ? "-10%" : "auto",
            }}
          >
            markhet
          </div>
        ))}
      </div>

      {/* Header */}
      <header className="flex justify-between items-center p-4 relative z-10">
        <h1 className="text-3xl font-bold text-gray-800">
          mark<span className="text-green-600">het</span>
        </h1>
        <button className="bg-green-600 text-white px-6 py-2 rounded-lg font-semibold hover:bg-green-700 transition">
          EN
        </button>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 pb-20 relative z-10">
        <h2 className="text-3xl font-bold text-green-700 mb-12 text-center">
          Upload Crop Photos
        </h2>

        {/* Instructions Card */}
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-2xl w-full">
          {/* Header with Icon */}
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
              <Info className="w-6 h-6 text-green-600" />
            </div>
            <h3 className="text-2xl font-bold text-gray-800">
              Before you start
            </h3>
          </div>

          {/* Instructions List */}
          <ul className="space-y-6">
            {[
              "Only live pictures allowed. Please make sure you are in the farm while clicking the pictures.",
              "Please click pictures of the mentioned crop only.",
              "Make sure the crop is clearly visible.",
            ].map((instruction, idx) => (
              <li key={idx} className="flex gap-4">
                <div className="w-3 h-3 rounded-full bg-green-600 mt-2 flex-shrink-0"></div>
                <p className="text-gray-700 text-lg leading-relaxed">
                  {instruction}
                </p>
              </li>
            ))}
          </ul>
        </div>

        {/* Info Box */}
        <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-6 max-w-2xl w-full mt-6">
          <p className="text-blue-800 text-center">
            Please use the link provided to you to start uploading photos.
          </p>
        </div>
      </main>
    </div>
  );
}