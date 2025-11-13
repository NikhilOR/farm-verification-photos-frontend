"use client";
import { useState, useRef, useEffect } from "react";
import imageCompression from "browser-image-compression";
import { useTranslation } from "react-i18next";

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

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "https://markhet-internal-dev.onrender.com";
const VERIFICATION_API_URL = process.env.NEXT_PUBLIC_VERIFICATION_API_URL || "http://localhost:5000/api/verifications/submit";
const SUPPORT_PHONE = process.env.NEXT_PUBLIC_SUPPORT_PHONE || "6206415125";
const MAX_PHOTOS = 3;
const CAMERA_WIDTH = 640;
const CAMERA_HEIGHT = 480;

export default function Home({
  params,
}: {
  params: { userId: string; cropName: string };
}) {
  const { t, i18n } = useTranslation();
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState<FormData>({
    fullName: "",
    phone: "",
    village: "",
    taluk: "",
    district: "",
    cropName: params.cropName || "",
    quantity: "",
    variety: "",
    moisture: "",
    willDry: "",
    photos: [],
    location: null,
  });

  const [cameraReady, setCameraReady] = useState(false);
  const [photoCaptured, setPhotoCaptured] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cameraAllowed, setCameraAllowed] = useState(false);
  const [viewingPhoto, setViewingPhoto] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    if (i18n.language !== 'kn') {
      i18n.changeLanguage('kn');
    }
  }, [i18n]);

  const toggleLanguage = () => {
    const newLang = i18n.language === 'en' ? 'kn' : 'en';
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

  useEffect(() => {
    const fetchUserData = async () => {
      if (!params.userId) {
        setError(t("errors.userIdRequired"));
        return;
      }
      if (!params.cropName) {
        setError(t("errors.cropNameRequired"));
        return;
      }

      setLoading(true);
      try {
        const response = await fetch(
          `${API_BASE_URL}/users/getbyid/${params.userId}`
        );
        const result = await response.json();

        if (result.code === 200 && result.data) {
          const user = result.data;
          let targetFarm = null;
          let targetCrop = null;

          if (user.farms && user.farms.length > 0) {
            for (const farm of user.farms) {
              if (farm.crops && farm.crops.length > 0) {
                const foundCrop = farm.crops.find(
                  (crop: any) =>
                    crop.cropName?.toLowerCase() === params.cropName.toLowerCase()
                );
                if (foundCrop) {
                  targetFarm = farm;
                  targetCrop = foundCrop;
                  break;
                }
              }
            }
            if (!targetFarm) {
              targetFarm = user.farms[0];
              targetCrop = targetFarm.crops?.[0] || null;
            }
          }

          let quantityDisplay = "";
          if (targetCrop?.quantity) {
            quantityDisplay = targetCrop.measure
              ? `${targetCrop.quantity} ${targetCrop.measure}`
              : targetCrop.quantity;
          } else if (targetCrop?.measure) {
            quantityDisplay = targetCrop.measure;
          }

          const varietyValue = targetCrop?.maizeVariety || targetCrop?.variety || "";

          setFormData((prev) => ({
            ...prev,
            fullName: user.name || "",
            phone: user.mobileNumber?.replace("+91", "") || "",
            village: targetFarm?.village || user.village || "",
            taluk: targetFarm?.taluk || user.taluk || "",
            district: targetFarm?.district || user.district || "",
            cropName: targetCrop?.cropName || params.cropName,
            quantity: quantityDisplay,
            variety: varietyValue,
            moisture: targetCrop?.moisturePercent?.toString() || "",
            willDry:
              targetCrop?.willYouDryIt === true
                ? "Yes"
                : targetCrop?.willYouDryIt === false
                ? "No"
                : "",
          }));
        } else {
          setError(result.message || t("errors.loadUserDataFailed"));
        }
      } catch (error: any) {
        console.error("Failed to fetch user data:", error);
        setError(t("errors.loadUserDataFailed"));
      } finally {
        setLoading(false);
      }
    };

    fetchUserData();
  }, [params.userId, params.cropName, t]);

  useEffect(() => {
    if (step === 2 && cameraAllowed && !photoCaptured) startCamera();
    return () => stopCamera();
  }, [step, cameraAllowed, photoCaptured]);

  const startCamera = async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: CAMERA_WIDTH },
          height: { ideal: CAMERA_HEIGHT },
          facingMode: "user",
        },
        audio: false,
      });

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = async () => {
          await videoRef.current?.play();
          setCameraReady(true);
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
    setCameraReady(false);
  };

  const addWatermark = (ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement) => {
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
    setError(null);
    setStep(2);
  };

  const handleSubmit = async () => {
    if (formData.photos.length === 0) {
      setError(t("errors.noPhotoCaptured"));
      return;
    }

    if (!params.userId) {
      setError(t("errors.userIdMissing"));
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
      uploadData.append("userId", params.userId);
      uploadData.append("cropName", formData.cropName);
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

      const res = await fetch(VERIFICATION_API_URL, {
        method: "POST",
        body: uploadData,
      });

      const result = await res.json();

      if (res.ok) {
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
        <div className="flex justify-between items-center max-w-md mx-auto">
          <div className="flex-1">
            {step > 1 && step < 3 && (
              <button
                onClick={handleGoBack}
                className="flex items-center gap-2 px-3 py-2 text-gray-700 hover:text-gray-900 transition-colors"
                aria-label="Go Back"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                <span className="text-base font-medium">{t("Back") || "Back"}</span>
              </button>
            )}
          </div>
          
          <div className="flex-1 text-center">
            <h1 className="text-3xl font-semibold tracking-wide">
              mark<span className="text-green-600 font-bold">het</span>
            </h1>
            <h2 className="text-2xl text-green-700 mt-2 font-medium">
              {t("header.subtitle")}
            </h2>
          </div>

          <div className="flex-1 flex justify-end">
            <button
              onClick={toggleLanguage}
              className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors shadow-sm"
              aria-label="Switch Language"
            >
              {i18n.language === 'en' ? 'ಕನ್ನಡ' : 'English'}
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
              <>
                <div key={i} className="flex flex-col items-center">
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
              </>
            );
          })}
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 p-6 max-w-md mx-auto w-full relative z-10">
        {step === 1 && (
          <div className="space-y-6">
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
                      <span className="text-sm text-gray-500">{t("cropCard.quantity")}</span>
                      <span className="text-base text-gray-900 font-medium text-right">
                        {formData.quantity || "-"}
                      </span>
                    </div>
                    <div className="flex justify-between items-start">
                      <span className="text-sm text-gray-500">{t("cropCard.variety")}</span>
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
                      <span className="text-sm text-gray-500">{t("farmCard.fullName")}</span>
                      <span className="text-base text-gray-900 font-medium text-right">
                        {formData.fullName || "-"}
                      </span>
                    </div>
                    <div className="flex justify-between items-start">
                      <span className="text-sm text-gray-500">{t("farmCard.phone")}</span>
                      <span className="text-base text-gray-900 font-medium text-right">
                        {formData.phone ? `+91 ${formData.phone}` : "-"}
                      </span>
                    </div>
                    <div className="flex justify-between items-start">
                      <span className="text-sm text-gray-500">{t("farmCard.village")}</span>
                      <span className="text-base text-gray-900 font-medium text-right">
                        {formData.village || "-"}
                      </span>
                    </div>
                    <div className="flex justify-between items-start">
                      <span className="text-sm text-gray-500">{t("farmCard.taluk")}</span>
                      <span className="text-base text-gray-900 font-medium text-right">
                        {formData.taluk || "-"}
                      </span>
                    </div>
                    <div className="flex justify-between items-start">
                      <span className="text-sm text-gray-500">{t("farmCard.district")}</span>
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
                    {(t("guidelines.points", { returnObjects: true }) as string[]).map((text: string, i: number) => (
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
                  {(t("guidelines.points", { returnObjects: true }) as string[]).map((text: string, i: number) => (
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
                  {t("cameraVerification.capturedPhotos").replace("{count}", formData.photos.length.toString())}
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {formData.photos.map((photo, idx) => (
                    <div key={idx} className="relative group">
                      <img
                        src={photo}
                        alt={`Photo ${idx + 1}`}
                        onClick={() => setViewingPhoto(photo)}
                        className="w-full h-24 object-cover rounded-lg border-2 border-green-600 cursor-pointer hover:opacity-80 transition-opacity"
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
                  <img
                    src={formData.photos[formData.photos.length - 1]}
                    alt="Preview"
                    className="w-full h-full object-cover rounded-lg"
                  />
                ) : (
                  <div className="flex items-center justify-center h-full text-gray-400">
                    {t("cameraVerification.cameraPreview")}
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
            <p className="text-gray-600 max-w-xs">
              {t("step3.message")}
            </p>
          </div>
        )}
      </main>

      {step === 1 && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 z-20">
          <div className="max-w-md mx-auto">
            <button
              onClick={handleStartVerification}
              disabled={loading}
              className={`w-full font-medium py-4 rounded-full transition-colors ${
                loading
                  ? "bg-gray-400 cursor-not-allowed text-white"
                  : "bg-green-700 hover:bg-green-800 text-white"
              }`}
            >
              {loading ? t("buttons.loading") : t("buttons.startVerification")}
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
            <img
              src={viewingPhoto}
              alt={t("photoViewer.altText")}
              className="w-full h-auto max-h-[80vh] object-contain rounded-lg"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
      )}
    </div>
  );
}