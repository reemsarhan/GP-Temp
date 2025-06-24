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

interface UploadedFile {
  file: File;
  progress: number;
  status: "uploading" | "completed" | "error";
  id: string;
  videoId?: string;
  uploadUrl?: string;
}

interface Keypoint {
  x: number;
  y: number;
}

export const VideoUpload = (): JSX.Element => {
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [keypoints, setKeypoints] = useState<Keypoint[]>([]);
  const [selectedVideoForKeypoints, setSelectedVideoForKeypoints] = useState<UploadedFile | null>(null);
  const [videoSize, setVideoSize] = useState({ width: 640, height: 360 });
  const [showKeypointSelection, setShowKeypointSelection] = useState(false);
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

  const uploadFile = async (file: File, uploadFile: UploadedFile) => {
    try {
      // Get upload URL from backend
      const uploadResponse = await apiClient.getUploadUrl(token!);
      
      // Update file with upload URL and video ID
      setUploadedFiles(prev => 
        prev.map(f => 
          f.id === uploadFile.id 
            ? { ...f, uploadUrl: uploadResponse.upload_url, videoId: uploadResponse.video_id }
            : f
        )
      );

      // Upload file with progress tracking
      await apiClient.uploadVideo(
        file,
        uploadResponse.upload_url,
        (progress) => {
          setUploadedFiles(prev => 
            prev.map(f => 
              f.id === uploadFile.id 
                ? { ...f, progress }
                : f
            )
          );
        }
      );

      // Mark as completed
      setUploadedFiles(prev => 
        prev.map(f => 
          f.id === uploadFile.id 
            ? { ...f, progress: 100, status: "completed" }
            : f
        )
      );
    } catch (error) {
      console.error('Upload failed:', error);
      setUploadedFiles(prev => 
        prev.map(f => 
          f.id === uploadFile.id 
            ? { ...f, status: "error" }
            : f
        )
      );
    }
  };

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const newFiles = acceptedFiles.map(file => ({
      file,
      progress: 0,
      status: "uploading" as const,
      id: Math.random().toString(36).substr(2, 9),
    }));

    setUploadedFiles(prev => [...prev, ...newFiles]);

    // Upload each file
    newFiles.forEach(uploadFile => {
      uploadFile.file && uploadFile(uploadFile.file, uploadFile);
    });
  }, [token]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'video/*': ['.mp4', '.mov', '.avi', '.mkv']
    },
    multiple: true
  });

  const removeFile = (id: string) => {
    setUploadedFiles(prev => prev.filter(f => f.id !== id));
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const handleSelectKeypoints = (uploadFile: UploadedFile) => {
    setSelectedVideoForKeypoints(uploadFile);
    setKeypoints([]);
    setShowKeypointSelection(true);

    // Load video for keypoint selection
    setTimeout(() => {
      const video = videoRef.current;
      if (video && uploadFile.file) {
        video.src = URL.createObjectURL(uploadFile.file);
        video.muted = true;

        video.onloadeddata = () => {
          video.currentTime = 0;
        };

        video.onseeked = () => drawFrameAndKeypoints();
        video.load();
      }
    }, 100);
  };

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (keypoints.length >= 12) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    const newPoint = { x, y };
    const updatedKeypoints = [...keypoints, newPoint];

    setKeypoints(updatedKeypoints);

    // Immediately draw the frame and updated keypoints
    setTimeout(() => {
      const ctx = canvas.getContext('2d');
      const video = videoRef.current;
      if (!ctx || !video) return;

      ctx.drawImage(video, 0, 0, videoSize.width, videoSize.height);

      updatedKeypoints.forEach(({ x, y }, index) => {
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
    }, 0);
  };

  const handleKeypointReset = () => {
    setKeypoints([]);
    drawFrameAndKeypoints();
  };

  const handleKeypointFinish = () => {
    if (keypoints.length !== 12) return;

    const json = JSON.stringify(keypoints, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = `keypoints_${selectedVideoForKeypoints?.file.name || 'video'}.json`;
    link.click();

    URL.revokeObjectURL(url);
    
    setShowKeypointSelection(false);
    setSelectedVideoForKeypoints(null);
    setKeypoints([]);
  };

  const cancelKeypointSelection = () => {
    setShowKeypointSelection(false);
    setSelectedVideoForKeypoints(null);
    setKeypoints([]);
  };

  useEffect(() => {
    if (selectedVideoForKeypoints) {
      drawFrameAndKeypoints();
    }
  }, [keypoints, selectedVideoForKeypoints, drawFrameAndKeypoints]);

  if (showKeypointSelection) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold mb-2">Select Court Keypoints</h1>
                          <p className="text-muted-foreground">
                Click on the video frame to select 12 key points of the padel court boundaries.
              </p>
          </div>
          <Button variant="outline" onClick={cancelKeypointSelection}>
            <X className="h-4 w-4 mr-2" />
            Cancel
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Video: {selectedVideoForKeypoints?.file.name}</span>
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
                  onClick={handleCanvasClick}
                  className="border-2 border-gray-300 dark:border-gray-600 rounded-lg cursor-crosshair bg-black"
                  style={{
                    width: videoSize.width,
                    height: videoSize.height,
                  }}
                />
                {keypoints.length === 0 && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="bg-black bg-opacity-75 text-white px-4 py-2 rounded-lg">
                      <Target className="h-6 w-6 mx-auto mb-2" />
                      <p className="text-sm">Click to place keypoints</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="text-center">
              <p className="text-gray-600 dark:text-gray-300 mb-4">
                Select the 12 corner points and boundaries of the padel court in order.
                {keypoints.length < 12 && (
                  <span className="text-blue-600 dark:text-blue-400">
                    {" "}({12 - keypoints.length} points remaining)
                  </span>
                )}
              </p>
              
              <div className="flex justify-center space-x-4">
                <Button
                  onClick={handleKeypointFinish}
                  disabled={keypoints.length !== 12}
                  className="bg-green-600 hover:bg-green-700"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download Keypoints JSON
                </Button>
                <Button
                  onClick={handleKeypointReset}
                  variant="outline"
                  disabled={keypoints.length === 0}
                >
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Reset Points
                </Button>
              </div>
            </div>

            {keypoints.length > 0 && (
              <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                <h4 className="font-medium mb-2">Selected Points:</h4>
                <div className="grid grid-cols-3 gap-2 text-sm">
                  {keypoints.map((point, index) => (
                    <div key={index} className="text-gray-600 dark:text-gray-300">
                      Point {index + 1}: ({Math.round(point.x)}, {Math.round(point.y)})
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold mb-2">Upload Match Video</h1>
        <p className="text-muted-foreground">
            Upload your padel match videos to get detailed analytics and insights.
          </p>
      </div>

      {/* Upload Area */}
      <Card>
        <CardHeader>
          <CardTitle>Video Files</CardTitle>
        </CardHeader>
        <CardContent>
          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
              isDragActive 
                ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20" 
                : "border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500"
            }`}
          >
            <input {...getInputProps()} />
            <Upload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            {isDragActive ? (
              <p className="text-blue-600 font-medium">Drop the videos here...</p>
            ) : (
              <div>
                <p className="text-gray-600 dark:text-gray-300 font-medium mb-2">
                  Drag & drop your match videos here, or click to select
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Supports MP4, MOV, AVI, MKV files up to 2GB each
                </p>
              </div>
            )}
          </div>

          {/* Uploaded Files */}
          {uploadedFiles.length > 0 && (
            <div className="mt-6 space-y-4">
              <h3 className="font-medium">Uploaded Files</h3>
              {uploadedFiles.map((uploadFile) => (
                                  <Card key={uploadFile.id} className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center">
                      <FileVideo className="h-5 w-5 text-blue-600 mr-2" />
                        <span className="font-medium">
                        {uploadFile.file.name}
                      </span>
                        <span className="text-sm text-muted-foreground ml-2">
                        ({formatFileSize(uploadFile.file.size)})
                      </span>
                    </div>
                    <div className="flex items-center space-x-2">
                      {uploadFile.status === "completed" && (
                        <>
                        <CheckCircle className="h-5 w-5 text-green-600 mr-2" />
                          <Button
                            size="sm"
                            onClick={() => handleSelectKeypoints(uploadFile)}
                            className="bg-blue-600 hover:bg-blue-700"
                          >
                            <Target className="h-4 w-4 mr-1" />
                            Select Keypoints
                          </Button>
                        </>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeFile(uploadFile.id)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  {uploadFile.status === "uploading" && (
                    <Progress value={uploadFile.progress} className="w-full" />
                  )}
                  {uploadFile.status === "completed" && (
                    <p className="text-sm text-green-600 font-medium">Upload completed - Ready for keypoint selection</p>
                  )}
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Match Metadata */}
      <Card>
        <CardHeader>
          <CardTitle>Match Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <label htmlFor="matchDate" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Match Date
            </label>
            <Input
              id="matchDate"
              type="date"
              value={metadata.matchDate}
              onChange={(e) => setMetadata(prev => ({ ...prev, matchDate: e.target.value }))}
            />
          </div>

          {/* Team 1 Players */}
          <div>
            <h3 className="text-lg font-medium mb-3">Team 1 Players</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="team1Player1" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Player 1 Name
                </label>
                <Input
                  id="team1Player1"
                  type="text"
                  placeholder="Enter player 1 name"
                  value={metadata.team1Player1}
                  onChange={(e) => setMetadata(prev => ({ ...prev, team1Player1: e.target.value }))}
                />
              </div>
              <div>
                <label htmlFor="team1Player2" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Player 2 Name
                </label>
                <Input
                  id="team1Player2"
                  type="text"
                  placeholder="Enter player 2 name"
                  value={metadata.team1Player2}
                  onChange={(e) => setMetadata(prev => ({ ...prev, team1Player2: e.target.value }))}
                />
              </div>
            </div>
          </div>

          {/* Team 2 Players */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-3">Team 2 Players</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="team2Player1" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Player 1 Name
                </label>
                <Input
                  id="team2Player1"
                  type="text"
                  placeholder="Enter player 1 name"
                  value={metadata.team2Player1}
                  onChange={(e) => setMetadata(prev => ({ ...prev, team2Player1: e.target.value }))}
                />
              </div>
              <div>
                <label htmlFor="team2Player2" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Player 2 Name
                </label>
                <Input
                  id="team2Player2"
                  type="text"
                  placeholder="Enter player 2 name"
                  value={metadata.team2Player2}
                  onChange={(e) => setMetadata(prev => ({ ...prev, team2Player2: e.target.value }))}
                />
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-3">Match Notes (Optional)</h3>
            <div>
              <label htmlFor="notes" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Notes
              </label>
              <textarea
                id="notes"
                rows={3}
                className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                placeholder="Add any notes about the match..."
                value={metadata.notes}
                onChange={(e) => setMetadata(prev => ({ ...prev, notes: e.target.value }))}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Process Button */}
      <div className="flex justify-end">
        <Button 
          size="lg"
          disabled={uploadedFiles.length === 0 || uploadedFiles.some(f => f.status === "uploading")}
          className="bg-blue-600 hover:bg-blue-700"
        >
          Process Videos for Analysis
        </Button>
      </div>
    </div>
  );
};