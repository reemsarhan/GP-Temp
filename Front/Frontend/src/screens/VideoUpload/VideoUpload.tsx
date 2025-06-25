import React, { useState, useCallback, useRef, useEffect } from "react";
import { useDropzone } from "react-dropzone";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Progress } from "../../components/ui/progress";
import { Upload, FileVideo, X, CheckCircle, Download, RotateCcw, Target } from "lucide-react";
import { Badge } from "../../components/ui/badge";
import { useAuth } from "../../contexts/AuthContext";
import { apiClient } from "../../lib/api";

interface Keypoint {
  x: number;
  y: number;
}

export const VideoUpload = (): JSX.Element => {
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [uploadStatus, setUploadStatus] = useState<"idle" | "uploading" | "completed" | "error">("idle");
  const [keypoints, setKeypoints] = useState<Keypoint[]>([]);
  const [videoId, setVideoId] = useState<string | null>(null);
  const [showKeypointSelection, setShowKeypointSelection] = useState(false);
  const [videoSize, setVideoSize] = useState({ width: 640, height: 360 });
  const [metadata, setMetadata] = useState({
    matchDate: "",
    notes: "",
    matchType: "doubles",
    // Team 1 players
    team1Player1: "",
    team1Player2: "",
    // Team 2 players
    team2Player1: "",
    team2Player2: "",
  });

  const { token } = useAuth();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const drawFrameAndKeypoints = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    canvas.width = videoSize.width;
    canvas.height = videoSize.height;

    // Draw video frame on canvas
    ctx.drawImage(video, 0, 0, videoSize.width, videoSize.height);

    // Draw keypoints
    keypoints.forEach(({ x, y }, index) => {
      ctx.beginPath();
      ctx.arc(x, y, 8, 0, 2 * Math.PI);
      ctx.fillStyle = '#EF4444';
      ctx.fill();
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 2;
      ctx.stroke();
      
      // Add number label
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '12px Arial';
      ctx.textAlign = 'center';
      ctx.fillText((index + 1).toString(), x, y + 4);
    });
  }, [keypoints, videoSize]);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      setVideoFile(acceptedFiles[0]);
      setKeypoints([]);
      setShowKeypointSelection(true);
      setUploadProgress(0);
      setUploadStatus("idle");
      setVideoId(null);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'video/*': ['.mp4', '.mov', '.avi', '.mkv']
    },
    multiple: false
  });

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (keypoints.length >= 12) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;
    setKeypoints(prev => [...prev, { x, y }]);
  };

  const handleKeypointReset = () => {
    setKeypoints([]);
    drawFrameAndKeypoints();
  };

  const handleKeypointFinish = async () => {
    if (!videoFile || keypoints.length !== 12 || !token) return;
    setUploadStatus("uploading");
    try {
      // 1. Get upload URL and video ID
      const uploadResponse = await apiClient.getUploadUrl(token);
      setVideoId(uploadResponse.video_id);
      // 2. Upload video
      await apiClient.uploadVideo(
        videoFile,
        uploadResponse.upload_url,
        (progress) => setUploadProgress(progress)
      );
      setUploadStatus("completed");
      setShowKeypointSelection(false);
      // Now you can use videoId and keypoints for the next step (e.g., send to analysis)
    } catch (error) {
      setUploadStatus("error");
    setShowKeypointSelection(false);
    }
  };

  const cancelKeypointSelection = () => {
    setShowKeypointSelection(false);
    setKeypoints([]);
    setVideoFile(null);
    setUploadProgress(0);
    setUploadStatus("idle");
    setVideoId(null);
  };

  // Add a new function for Back
  const backToVideoSelection = () => {
    setShowKeypointSelection(false);
    setKeypoints([]);
    // Keep videoFile so user can re-pick keypoints
  };

  useEffect(() => {
    if (showKeypointSelection && videoFile) {
      const video = videoRef.current;
      if (video) {
        video.src = URL.createObjectURL(videoFile);
        video.muted = true;
        video.onloadeddata = () => {
          video.currentTime = 0;
        };
        video.onseeked = () => drawFrameAndKeypoints();
        video.load();
      }
    }
  }, [showKeypointSelection, videoFile, drawFrameAndKeypoints]);

  useEffect(() => {
    if (showKeypointSelection) {
      drawFrameAndKeypoints();
    }
  }, [keypoints, showKeypointSelection, drawFrameAndKeypoints]);

  if (showKeypointSelection && videoFile) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold mb-2">Select Court Keypoints</h1>
                          <p className="text-muted-foreground">
                Click on the video frame to select 12 key points of the padel court boundaries.
              </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={backToVideoSelection}>
              <span className="mr-2">Back</span>
            </Button>
            <Button variant="destructive" onClick={cancelKeypointSelection}>
            <X className="h-4 w-4 mr-2" />
            Cancel
          </Button>
        </div>
        </div>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Video: {videoFile.name}</span>
              <Badge variant="outline">
                {keypoints.length}/12 points selected
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-center">
              <div className="relative">
                <video
                  ref={videoRef}
                  style={{ display: 'none' }}
                  width={videoSize.width}
                  height={videoSize.height}
                />
                <canvas
                  ref={canvasRef}
                  width={videoSize.width}
                  height={videoSize.height}
                  onClick={handleCanvasClick}
                  style={{ cursor: keypoints.length < 12 ? 'crosshair' : 'not-allowed', border: '2px solid #ccc' }}
                />
              </div>
            </div>
            <div className="flex items-center gap-4">
              <Button onClick={handleKeypointReset} variant="secondary" disabled={keypoints.length === 0}>
                <RotateCcw className="h-4 w-4 mr-2" />
                Reset
              </Button>
                <Button
                  onClick={handleKeypointFinish}
                disabled={keypoints.length !== 12 || uploadStatus === "uploading"}
                className={`bg-blue-600 hover:bg-blue-700 text-white font-semibold ${keypoints.length === 12 && uploadStatus !== "uploading" ? "animate-pulse" : "opacity-60"}`}
                >
                {uploadStatus === "uploading" ? "Uploading..." : "Finish & Upload"}
                </Button>
              {keypoints.length !== 12 && (
                <span className="text-sm text-gray-400">Select all 12 keypoints to enable upload</span>
              )}
            </div>
            {uploadStatus === "uploading" && (
              <Progress value={uploadProgress} className="w-full" />
            )}
            {uploadStatus === "completed" && (
              <div className="text-green-500 font-semibold">Upload completed! Video ID: {videoId}</div>
            )}
            {uploadStatus === "error" && (
              <div className="text-red-500 font-semibold">Upload failed. Please try again.</div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div {...getRootProps()} className="border-2 border-dashed border-gray-400 rounded-lg p-8 text-center cursor-pointer bg-white/10 hover:bg-white/20 transition">
        <input {...getInputProps()} />
        <Upload className="mx-auto h-12 w-12 text-blue-500 mb-4" />
        <p className="text-lg font-semibold text-gray-200">Drag & drop a video file here, or click to select</p>
        <p className="text-gray-400">Only one video at a time. Supported formats: mp4, mov, avi, mkv</p>
      </div>
      {videoFile && uploadStatus !== "completed" && (
        <div className="flex items-center gap-4 mt-4">
          <FileVideo className="h-6 w-6 text-blue-500" />
          <span className="text-gray-200">{videoFile.name}</span>
          <Button variant="outline" size="sm" onClick={cancelKeypointSelection}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
      )}
      {uploadStatus === "completed" && (
        <div className="text-green-500 font-semibold">Video uploaded successfully! Video ID: {videoId}</div>
      )}
    </div>
  );
};