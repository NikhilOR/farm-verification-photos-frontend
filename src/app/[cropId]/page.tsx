"use client";
import React, { useState, useRef, useEffect } from "react";
import Image from "next/image";
import imageCompression from "browser-image-compression";
import { useTranslation } from "react-i18next";
import { useParams } from "next/navigation";

type FormData = {
  fullName: string;
  phone: string;
  village: string;
  taluk: string;
  district: string;
  cropName: string;
  quantity: string;
  variety: string;
  moisture: string;
  willDry: string;
  photos: string[];
  location: { lat: number; lng: number } | null;
};

type VerificationStatus = {
  hasVerification: boolean;
  canSubmit: boolean;
  status: string | null;
  blockMessage: string | null;
  existingRequestId?: string;
  isResubmission?: boolean;
};

// 🆕 NEW: Crop API URL
const CROP_API_URL =
  process.env.NEXT_PUBLIC_CROP_API_URL ||
  "https://markhet-internal-ngfs.onrender.com";

const VERIFICATION_API_URL =
  process.env.NEXT_PUBLIC_VERIFICATION_API_URL ||
  "http://localhost:5000/api/verifications/submit";
const VERIFICATION_STATUS_URL =
  process.env.NEXT_PUBLIC_VERIFICATION_STATUS_URL ||
  "http://localhost:5000/api/verifications/user";
const SUPPORT_PHONE = process.env.NEXT_PUBLIC_SUPPORT_PHONE || "6206415125";
const MAX_PHOTOS = 3;
const CAMERA_WIDTH = 640;
const CAMERA_HEIGHT = 480;

export default function Home() {
  const { t, i18n } = useTranslation();
  const params = useParams();

  // 🔄 CHANGED: Extract only cropId from params
  const cropId = typeof params?.cropId === "string" ? params.cropId : "";

  // 🆕 NEW: Store userId (will be fetched from API)
  const [userId, setUserId] = useState<string>("");

  const [step, setStep] = useState(1);

  const [formData, setFormData] = useState<FormData>({
    fullName: "",
    phone: "",
    village: "",
    taluk: "",
    district: "",
    cropName: "", // 🔄 CHANGED: Will be fetched from API
    quantity: "",
    variety: "",
    moisture: "",
    willDry: "",
    photos: [],
    location: null,
  });

  const [photoCaptured, setPhotoCaptured] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cameraAllowed, setCameraAllowed] = useState(false);
  const [viewingPhoto, setViewingPhoto] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [verificationStatus, setVerificationStatus] =
    useState<VerificationStatus | null>(null);
  const [checkingStatus, setCheckingStatus] = useState(true);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    if (i18n.language !== "kn") {
      i18n.changeLanguage("kn");
    }
  }, [i18n]);

  const toggleLanguage = () => {
    const newLang = i18n.language === "en" ? "kn" : "en";
    i18n.changeLanguage(newLang);
  };

  const handleGoBack = () => {
    if (step === 2) {
      stopCamera();
      setCameraAllowed(false);
      setPhotoCaptured(false);
      setError(null);
    }
    if (step > 1) {
      setStep(step - 1);
    }
  };

  // 🔄 CHANGED: Fetch crop data from crop API
  useEffect(() => {
    const fetchCropData = async () => {
      if (!cropId) {
        setError(t("errors.cropIdRequired") || "Crop ID is required");
        setCheckingStatus(false);
        return;
      }

      setLoading(true);
      try {
        // 🆕 NEW: Fetch from crop API
        const response = await fetch(
          `${CROP_API_URL}/crop/get-crop-by-id/${cropId}`
        );
        const result = await response.json();

        if (result.code === 200 && result.data) {
          const cropData = result.data;
          const farmData = cropData.farm;
          const userData = cropData.farm.user;

          // 🆕 NEW: Extract and store userId
          setUserId(userData.id);

          console.log(
            `✅ Fetched crop data for cropId: ${cropId}, userId: ${userData.id}`
          );

          // 🔄 CHANGED: Build quantity display
          let quantityDisplay = "";
          if (cropData.quantity) {
            quantityDisplay = cropData.measure
              ? `${cropData.quantity} ${cropData.measure}`
              : cropData.quantity.toString();
          } else if (cropData.measure) {
            quantityDisplay = cropData.measure;
          }

          // 🔄 CHANGED: Get variety value
          const varietyValue =
            cropData.maizeVariety || cropData.otherVarietyName || "";

          // 🔄 CHANGED: Extract coordinates from farm
          let location = null;
          if (farmData.coordinates?.coordinates) {
            location = {
              lat: farmData.coordinates.coordinates[1],
              lng: farmData.coordinates.coordinates[0],
            };
          }

          setFormData((prev) => ({
            ...prev,
            fullName: userData.name || "",
            phone: userData.mobileNumber?.replace("+91", "") || "",
            village: farmData.village || "",
            taluk: farmData.taluk || "",
            district: farmData.district || "",
            cropName: cropData.cropName || "",
            quantity: quantityDisplay,
            variety: varietyValue,
            moisture: cropData.moisturePercent?.toString() || "",
            willDry:
              cropData.willYouDryIt === true
                ? "Yes"
                : cropData.willYouDryIt === false
                ? "No"
                : "",
            location: location,
          }));
        } else {
          setError(
            result.message ||
              t("errors.loadCropDataFailed") ||
              "Failed to load crop data"
          );
        }
      } catch (error) {
        console.error("Failed to fetch crop data:", error);
        setError(t("errors.loadCropDataFailed") || "Failed to load crop data");
      } finally {
        setLoading(false);
      }
    };

    if (cropId) {
      fetchCropData();
    }
  }, [cropId, t]);

  // 🔄 CHANGED: Check verification status (runs after userId is set)
  useEffect(() => {
    const checkVerificationStatus = async () => {
      if (!userId) {
        return; // Wait for userId to be fetched
      }

      try {
        const response = await fetch(
          `${VERIFICATION_STATUS_URL}/${userId}/current-status`
        );
        const result = await response.json();

        if (response.ok && result.statusCode === 200) {
          setVerificationStatus({
            hasVerification: result.data.hasVerification,
            canSubmit: result.data.canSubmit,
            status: result.data.verification?.status || null,
            blockMessage: result.data.blockMessage || null,
            existingRequestId: result.data.verification?.id,
          });
        } else {
          console.error("Failed to check status:", result);
        }
      } catch (err) {
        console.error("Error checking verification status:", err);
      } finally {
        setCheckingStatus(false);
      }
    };

    if (userId) {
      checkVerificationStatus();
    }
  }, [userId]);

  useEffect(() => {
    if (step === 2 && cameraAllowed && !photoCaptured) {
      startCamera();
    }
    return () => stopCamera();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, cameraAllowed, photoCaptured]);

  const startCamera = async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: CAMERA_WIDTH },
          height: { ideal: CAMERA_HEIGHT },
          facingMode: { exact: "environment" }, // 🔄 CHANGED: Use rear camera
        },
        audio: false,
      });

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = async () => {
          await videoRef.current?.play();
        };
      }
    } catch (err) {
      console.error("Camera access denied:", err);
      setError(t("errors.cameraDenied"));
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
  };

  const addWatermark = (
    ctx: CanvasRenderingContext2D,
    canvas: HTMLCanvasElement
  ) => {
    ctx.fillStyle = "rgba(255,255,255,0.7)";
    ctx.fillRect(10, 10, 140, 40);
    ctx.font = "bold 24px Arial";
    ctx.fillStyle = "#374151";
    ctx.fillText("mark", 20, 38);
    ctx.fillStyle = "#16a34a";
    ctx.fillText("het", 80, 38);
    ctx.fillStyle = "#16a34a";
    ctx.fillText(".", 120, 38);

    const now = new Date();
    const timestamp = now.toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.fillRect(canvas.width - 200, canvas.height - 35, 190, 25);
    ctx.font = "12px Arial";
    ctx.fillStyle = "#ffffff";
    ctx.fillText(timestamp, canvas.width - 195, canvas.height - 17);
  };

  const capturePhoto = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    if (video.videoWidth === 0) {
      setError(t("errors.cameraDenied"));
      return;
    }

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");

    if (!ctx) return;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    addWatermark(ctx, canvas);

    const dataUrl = canvas.toDataURL("image/jpeg");
    setFormData((prev) => ({ ...prev, photos: [...prev.photos, dataUrl] }));
    setPhotoCaptured(true);
    stopCamera();
  };

  const retakePhoto = () => {
    setFormData((prev) => ({ ...prev, photos: prev.photos.slice(0, -1) }));
    setPhotoCaptured(false);
  };

  const removePhoto = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      photos: prev.photos.filter((_, i) => i !== index),
    }));
  };

  const captureAnother = () => setPhotoCaptured(false);

  const allowCameraAccess = async () => {
    setError(null);
    try {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) =>
            setFormData((prev) => ({
              ...prev,
              location: { lat: pos.coords.latitude, lng: pos.coords.longitude },
            })),
          () => setError(t("errors.locationAccess"))
        );
      }
      setCameraAllowed(true);
    } catch (err) {
      console.error("Failed to access camera/location:", err);
      setError(t("errors.cameraLocationAccessFailed"));
    }
  };

  const handleStartVerification = () => {
    if (verificationStatus && !verificationStatus.canSubmit) {
      setError(
        verificationStatus.blockMessage ||
          "Cannot submit new verification request"
      );
      return;
    }

    setError(null);
    setStep(2);
  };

  // 🔄 CHANGED: Submit with cropId instead of userId + cropName
  const handleSubmit = async () => {
    if (formData.photos.length === 0) {
      setError(t("errors.noPhotoCaptured"));
      return;
    }

    if (!cropId) {
      setError(t("errors.cropIdMissing") || "Crop ID is missing");
      return;
    }

    if (verificationStatus && !verificationStatus.canSubmit) {
      setError(
        verificationStatus.blockMessage ||
          "Cannot submit new verification request"
      );
      return;
    }

    setLoading(true);
    stopCamera();
    setError(null);

    try {
      const compressedPhotos = await Promise.all(
        formData.photos.map(async (dataUrl) => {
          const blob = await (await fetch(dataUrl)).blob();
          const file = new File([blob], `photo-${Date.now()}.jpg`, {
            type: "image/jpeg",
          });
          return await imageCompression(file, {
            maxSizeMB: 0.5,
            maxWidthOrHeight: 1024,
            useWebWorker: true,
          });
        })
      );

      const uploadData = new FormData();

      // 🔄 CHANGED: Send cropId instead of userId and cropName
      uploadData.append("cropId", cropId);

      // 🔄 CHANGED: These are now optional (backend will fetch from API)
      uploadData.append("fullName", formData.fullName);
      uploadData.append("phone", formData.phone);
      uploadData.append("village", formData.village);
      uploadData.append("taluk", formData.taluk);
      uploadData.append("district", formData.district);
      uploadData.append("quantity", formData.quantity);
      uploadData.append("variety", formData.variety);

      const isMaize = formData.cropName?.toLowerCase() === "maize";
      if (isMaize && formData.moisture) {
        uploadData.append("moisture", formData.moisture);
      }
      if (isMaize && formData.willDry) {
        uploadData.append("willDry", formData.willDry);
      }

      uploadData.append("location", JSON.stringify(formData.location));
      compressedPhotos.forEach((file) => uploadData.append("photos", file));

      console.log(`📤 Submitting verification for cropId: ${cropId}`);

      const res = await fetch(VERIFICATION_API_URL, {
        method: "POST",
        body: uploadData,
      });

      const result = await res.json();

      if (res.status === 409) {
        setError(result.message || "Cannot submit verification request");
        console.error("Submission blocked:", result);
      } else if (res.ok && result.statusCode === 200) {
        console.log("✅ Verification submitted:", result.data);

        if (result.data.isResubmission) {
          console.log("🔄 This was a resubmission after previous rejection");
        }

        setStep(3);
      } else {
        setError(result.message || t("errors.submissionFailed"));
        console.error("Submission failed:", result);
      }
    } catch (err) {
      console.error("Submission error:", err);
      setError(t("errors.submitError"));
    } finally {
      setLoading(false);
    }
  };

  const isMaize = formData.cropName?.toLowerCase() === "maize";

  // 🔄 CHANGED: Show loading state while checking cropId and status
  if (!cropId || checkingStatus) {
    return (
      <div className="min-h-screen bg-[#FFF9E4] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // 🆕 NEW: Show error state if crop data failed to load
  if (error && !formData.cropName && !loading) {
    return (
      <div className="min-h-screen bg-[#FFF9E4] flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-lg p-8 text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-8 h-8 text-red-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </div>

          <h2 className="text-xl font-semibold text-gray-800 mb-2">
            {t("errors.cropNotFoundTitle") || "Crop Not Found"}
          </h2>

          <p className="text-gray-600 mb-6">{error}</p>

          <a
            href={`tel:${SUPPORT_PHONE}`}
            className="inline-flex items-center gap-2 px-6 py-3 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 transition-colors"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
              />
            </svg>
            {t("incorrectDetails.callUs") || "Call Support"}
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FFF9E4] flex flex-col relative pb-24">
      {/* Background Watermark */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden opacity-[0.08]">
        <div className="absolute inset-0">
          {[...Array(100)].map((_, i) => {
            const row = Math.floor(i / 5);
            const col = i % 5;
            return (
              <div
                key={i}
                className="absolute text-4xl sm:text-6xl font-bold text-gray-800 whitespace-nowrap select-none"
                style={{
                  top: `${row * 100}px`,
                  left: `${col * 100 - 50}px`,
                  transform: "rotate(-45deg)",
                }}
              >
                mark<span className="text-green-600">het</span>.
              </div>
            );
          })}
        </div>
      </div>

      {/* Header */}
      <header className="bg-white border-b border-gray-200 py-4 px-6 relative z-10">
        <div className="max-w-md mx-auto">
          {/* Back button (if needed) */}
          {step > 1 && step < 3 && (
            <button
              onClick={handleGoBack}
              className="flex items-center gap-2 px-3 py-2 text-gray-700 hover:text-gray-900 transition-colors mb-3"
              aria-label="Go Back"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 19l-7-7 7-7"
                />
              </svg>
              <span className="text-base font-medium">
                {t("Back") || "Back"}
              </span>
            </button>
          )}

          {/* Main header layout */}
          <div className="flex justify-between items-start">
            {/* Left: Logo and subtitle */}
            <div className="flex-1">
              <h1 className="text-2xl font-semibold tracking-wide">
                mark<span className="text-green-600 font-bold">het</span>
              </h1>
              <h2 className="text-base text-gray-600 mt-1">
                {t("header.subtitle")}
              </h2>
            </div>

            {/* Right: Language switcher with globe icon */}
            <button
              onClick={toggleLanguage}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors shadow-sm ml-4"
              aria-label="Switch Language"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129"
                />
              </svg>
              <span>{i18n.language === "en" ? "ಕನ್ನಡ" : "English"}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Progress Steps */}
      <div className="flex justify-center items-center py-6 bg-gray-100 border-b relative z-10">
        <div className="flex items-center max-w-md w-full px-6">
          {["details", "verify", "profile"].map((label, i) => {
            const currentStep = i + 1;
            return (
              <React.Fragment key={label}>
                <div className="flex flex-col items-center">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center font-medium text-sm transition-colors ${
                      step >= currentStep
                        ? "bg-green-600 text-white"
                        : "bg-gray-300 text-gray-600"
                    }`}
                  >
                    {step > currentStep ? (
                      <svg
                        className="w-6 h-6"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={3}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                    ) : (
                      currentStep
                    )}
                  </div>
                  <span
                    className={`text-xs mt-2 font-medium ${
                      step >= currentStep ? "text-green-600" : "text-gray-500"
                    }`}
                  >
                    {t(`steps.${label}`)}
                  </span>
                </div>
                {i < 2 && (
                  <div
                    className={`flex-1 h-1 mx-4 self-start mt-5 transition-colors ${
                      step > currentStep ? "bg-green-600" : "bg-gray-300"
                    }`}
                  />
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 p-6 max-w-md mx-auto w-full relative z-10">
        {step === 1 && (
          <div className="space-y-6">
            {/* Show verification status warning if cannot submit */}
            {verificationStatus && !verificationStatus.canSubmit && (
              <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded-lg">
                <div className="flex items-start">
                  <svg
                    className="w-6 h-6 text-yellow-600 mr-3 flex-shrink-0"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <div>
                    <h3 className="text-sm font-medium text-yellow-800 mb-1">
                      {verificationStatus.status === "pending"
                        ? "Verification Under Review"
                        : "Already Verified"}
                    </h3>
                    <p className="text-sm text-yellow-700">
                      {verificationStatus.blockMessage}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Show resubmission info if previous was rejected */}
            {verificationStatus &&
              verificationStatus.canSubmit &&
              verificationStatus.status === "rejected" && (
                <div className="bg-blue-50 border-l-4 border-blue-400 p-4 rounded-lg">
                  <div className="flex items-start">
                    <svg
                      className="w-6 h-6 text-blue-600 mr-3 flex-shrink-0"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                        clipRule="evenodd"
                      />
                    </svg>
                    <div>
                      <h3 className="text-sm font-medium text-blue-800 mb-1">
                        Ready for Resubmission
                      </h3>
                      <p className="text-sm text-blue-700">
                        Your previous request was reviewed. You can now submit a
                        new verification request.
                      </p>
                    </div>
                  </div>
                </div>
              )}

            {loading ? (
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200 flex items-center justify-center min-h-[200px]">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
                  <p className="text-gray-600">{t("loading.farmDetails")}</p>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-center gap-3 bg-blue-50 rounded-2xl py-4 shadow-md">
                  <span className="text-green-700 text-3xl">🌾</span>
                  <h2 className="text-2xl font-bold text-green-700">
                    {formData.cropName || t("cropCard.cropNamePlaceholder")}
                  </h2>
                </div>

                <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200">
                  <h2 className="text-lg font-semibold text-gray-800 mb-4">
                    {t("cropCard.cropDetailsTitle")}
                  </h2>
                  <div className="space-y-3">
                    <div className="flex justify-between items-start">
                      <span className="text-sm text-gray-500">
                        {t("cropCard.quantity")}
                      </span>
                      <span className="text-base text-gray-900 font-medium text-right">
                        {formData.quantity || "-"}
                      </span>
                    </div>
                    <div className="flex justify-between items-start">
                      <span className="text-sm text-gray-500">
                        {t("cropCard.variety")}
                      </span>
                      <span className="text-base text-gray-900 font-medium text-right">
                        {formData.variety || "-"}
                      </span>
                    </div>
                    {isMaize && (
                      <>
                        <div className="flex justify-between items-start">
                          <span className="text-sm text-gray-500">
                            {t("cropCard.moisture")}
                          </span>
                          <span className="text-base text-gray-900 font-medium text-right">
                            {formData.moisture ? `${formData.moisture}%` : "-"}
                          </span>
                        </div>
                        <div className="flex justify-between items-start">
                          <span className="text-sm text-gray-500">
                            {t("cropCard.willDry")}
                          </span>
                          <span className="text-base text-gray-900 font-medium text-right">
                            {formData.willDry || "-"}
                          </span>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200">
                  <h2 className="text-lg font-semibold text-gray-800 mb-4">
                    {t("farmCard.title")}
                  </h2>
                  <div className="space-y-3">
                    <div className="flex justify-between items-start">
                      <span className="text-sm text-gray-500">
                        {t("farmCard.fullName")}
                      </span>
                      <span className="text-base text-gray-900 font-medium text-right">
                        {formData.fullName || "-"}
                      </span>
                    </div>
                    <div className="flex justify-between items-start">
                      <span className="text-sm text-gray-500">
                        {t("farmCard.phone")}
                      </span>
                      <span className="text-base text-gray-900 font-medium text-right">
                        {formData.phone ? `+91 ${formData.phone}` : "-"}
                      </span>
                    </div>
                    <div className="flex justify-between items-start">
                      <span className="text-sm text-gray-500">
                        {t("farmCard.village")}
                      </span>
                      <span className="text-base text-gray-900 font-medium text-right">
                        {formData.village || "-"}
                      </span>
                    </div>
                    <div className="flex justify-between items-start">
                      <span className="text-sm text-gray-500">
                        {t("farmCard.taluk")}
                      </span>
                      <span className="text-base text-gray-900 font-medium text-right">
                        {formData.taluk || "-"}
                      </span>
                    </div>
                    <div className="flex justify-between items-start">
                      <span className="text-sm text-gray-500">
                        {t("farmCard.district")}
                      </span>
                      <span className="text-base text-gray-900 font-medium text-right">
                        {formData.district || "-"}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="bg-blue-50 rounded-xl p-4 border border-blue-200 text-center">
                  <p className="text-xl text-red-700">
                    {t("incorrectDetails.text")}{" "}
                    <a
                      href={`tel:${SUPPORT_PHONE}`}
                      className="text-blue-600 font-semibold hover:text-blue-700 underline"
                    >
                      {t("incorrectDetails.callUs")}
                    </a>
                  </p>
                </div>

                <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200">
                  <h3 className="text-lg font-semibold text-gray-800 mb-4">
                    {t("guidelines.title")}
                  </h3>
                  <div className="bg-gray-50 rounded-xl p-4 space-y-3">
                    {(
                      t("guidelines.points", {
                        returnObjects: true,
                      }) as string[]
                    ).map((text: string, i: number) => (
                      <div key={i} className="flex gap-3">
                        <span className="text-gray-700 text-sm mt-0.5">•</span>
                        <p className="text-sm text-gray-700 flex-1">{text}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6">
            {!cameraAllowed && (
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">
                  {t("guidelines.title")}
                </h3>
                <div className="bg-gray-50 rounded-xl p-4 space-y-3">
                  {(
                    t("guidelines.points", { returnObjects: true }) as string[]
                  ).map((text: string, i: number) => (
                    <div key={i} className="flex gap-3">
                      <span className="text-gray-700 text-sm mt-0.5">•</span>
                      <p className="text-sm text-gray-700 flex-1">{text}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <h2 className="text-xl font-semibold text-gray-800">
              {t("cameraVerification.title")}
            </h2>
            <p className="text-sm text-gray-600">
              {t("cameraVerification.instructions")}
            </p>

            {formData.photos.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs text-gray-500 font-medium">
                  {t("cameraVerification.capturedPhotos").replace(
                    "{count}",
                    formData.photos.length.toString()
                  )}
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {formData.photos.map((photo, idx) => (
                    <div key={idx} className="relative group">
                      <Image
                        src={photo}
                        alt={`Photo ${idx + 1}`}
                        width={96}
                        height={96}
                        onClick={() => setViewingPhoto(photo)}
                        className="w-full h-24 object-cover rounded-lg border-2 border-green-600 cursor-pointer hover:opacity-80 transition-opacity"
                        unoptimized
                      />
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          removePhoto(idx);
                        }}
                        className="absolute -top-2 -right-2 bg-red-600 text-white rounded-full w-6 h-6 flex items-center justify-center shadow-lg hover:bg-red-700"
                      >
                        ×
                      </button>
                      <span className="absolute bottom-1 left-1 bg-black bg-opacity-60 text-white text-xs px-2 py-0.5 rounded">
                        {idx + 1}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="relative">
              <div className="w-full h-64 bg-gray-200 rounded-lg overflow-hidden relative">
                {!photoCaptured && cameraAllowed ? (
                  <video
                    ref={videoRef}
                    className="w-full h-full object-cover"
                    autoPlay
                    muted
                    playsInline
                  />
                ) : photoCaptured && formData.photos.length > 0 ? (
                  <Image
                    src={formData.photos[formData.photos.length - 1]}
                    alt="Preview"
                    width={640}
                    height={256}
                    className="w-full h-full object-cover rounded-lg"
                    unoptimized
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-gray-500 px-6">
                    <svg className="w-16 h-16 text-gray-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <p className="text-sm text-center font-medium">
                      {t("cameraVerification.activateCameraPrompt")}
                    </p>
                  </div>
                )}
                <canvas ref={canvasRef} className="hidden" />
              </div>
            </div>

            {photoCaptured && (
              <button
                onClick={retakePhoto}
                className="w-full py-3 bg-gray-200 text-gray-800 font-semibold rounded-xl hover:bg-gray-300 transition-colors"
              >
                {t("cameraVerification.retake")}
              </button>
            )}

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}
          </div>
        )}

        {step === 3 && (
          <div className="flex flex-col items-center justify-center space-y-4 min-h-[300px] text-center">
            <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center">
              <svg
                className="w-12 h-12 text-green-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={3}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-gray-800">
              {t("step3.title")}
            </h2>
            <p className="text-gray-600 max-w-xs">{t("step3.message")}</p>
          </div>
        )}
      </main>

      {step === 1 && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 z-20">
          <div className="max-w-md mx-auto">
            <button
              onClick={handleStartVerification}
              disabled={
                loading ||
                (verificationStatus ? !verificationStatus.canSubmit : false)
              }
              className={`w-full font-medium py-4 rounded-full transition-colors ${
                loading || (verificationStatus && !verificationStatus.canSubmit)
                  ? "bg-gray-400 cursor-not-allowed text-white"
                  : "bg-green-700 hover:bg-green-800 text-white"
              }`}
            >
              {loading
                ? t("buttons.loading")
                : verificationStatus && !verificationStatus.canSubmit
                ? "Cannot Start Verification"
                : t("buttons.startVerification")}
            </button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 z-20">
          <div className="max-w-md mx-auto">
            {!cameraAllowed ? (
              <button
                onClick={allowCameraAccess}
                className="w-full font-medium py-4 rounded-full bg-green-700 hover:bg-green-800 text-white transition-colors"
              >
                {t("buttons.allowCameraAccess")}
              </button>
            ) : !photoCaptured ? (
              <button
                onClick={capturePhoto}
                className="w-full font-medium py-4 rounded-full bg-green-700 hover:bg-green-800 text-white transition-colors"
              >
                {t("buttons.capturePhoto")}
              </button>
            ) : (
              <div className="flex gap-2">
                {formData.photos.length < MAX_PHOTOS && (
                  <button
                    onClick={captureAnother}
                    className="flex-1 font-medium py-4 rounded-full bg-green-700 hover:bg-green-800 text-white transition-colors"
                  >
                    {t("buttons.captureAnother")}
                  </button>
                )}
                {formData.photos.length > 0 && (
                  <button
                    onClick={handleSubmit}
                    disabled={loading}
                    className="flex-1 font-medium py-4 rounded-full bg-blue-600 hover:bg-blue-700 text-white transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
                  >
                    {loading ? t("buttons.submitting") : t("buttons.submit")}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {viewingPhoto && (
        <div
          className="fixed inset-0 bg-black bg-opacity-90 z-50 flex items-center justify-center p-4"
          onClick={() => setViewingPhoto(null)}
        >
          <div className="relative max-w-4xl w-full">
            <button
              onClick={() => setViewingPhoto(null)}
              className="absolute -top-12 right-0 text-white hover:text-gray-300 text-4xl font-light"
            >
              ×
            </button>
            <Image
              src={viewingPhoto}
              alt={t("photoViewer.altText")}
              width={1200}
              height={900}
              className="w-full h-auto max-h-[80vh] object-contain rounded-lg"
              onClick={(e) => e.stopPropagation()}
              unoptimized
            />
          </div>
        </div>
      )}
    </div>
  );
}
