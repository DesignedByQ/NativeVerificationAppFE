// import { useEffect, useRef } from "react";

// type Props = {
//   onCapture: (base64: string) => void;
//   onCancel?: () => void;
//   className?: string;
// };

// export default function WebCamera({ onCapture, onCancel, className }: Props) {
//   const videoRef = useRef<HTMLVideoElement | null>(null);
//   const streamRef = useRef<MediaStream | null>(null);
//   const canvasRef = useRef<HTMLCanvasElement | null>(null);

//   useEffect(() => {
//     let mounted = true;
//     const start = async () => {
//       try {
//         const stream = await navigator.mediaDevices.getUserMedia({
//           video: { facingMode: "user" },
//           audio: false,
//         });
//         if (!mounted) {
//           stream.getTracks().forEach((t) => t.stop());
//           return;
//         }
//         streamRef.current = stream;
//         if (videoRef.current) {
//           videoRef.current.srcObject = stream;
//           await videoRef.current.play();
//         }
//       } catch (err) {
//         console.error("Camera start failed", err);
//         alert("Unable to access camera. Check permissions.");
//         onCancel?.();
//       }
//     };

//     start();

//     return () => {
//       mounted = false;
//       // stop tracks on unmount
//       streamRef.current?.getTracks().forEach((t) => t.stop());
//       streamRef.current = null;
//     };
//   }, [onCancel]);

//   const takePhoto = () => {
//     const video = videoRef.current;
//     if (!video) return;
//     const canvas = canvasRef.current ?? document.createElement("canvas");
//     canvas.width = video.videoWidth || 640;
//     canvas.height = video.videoHeight || 480;
//     const ctx = canvas.getContext("2d");
//     if (!ctx) return;
//     ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
//     const dataUrl = canvas.toDataURL("image/jpeg", 0.8);
//     const base64 = dataUrl.split(",")[1];
//     onCapture(base64);
//   };

//   return (
//     <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 8 }}>
//       <video ref={videoRef} className={className} playsInline muted />
//       <canvas ref={canvasRef} style={{ display: "none" }} />
//       <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
//         <button type="button" onClick={takePhoto} className="capture-button">
//           Capture
//         </button>
//         <button type="button" onClick={() => onCancel?.()} className="retake-button">
//           Cancel
//         </button>
//       </div>
//     </div>
//   );
// }
