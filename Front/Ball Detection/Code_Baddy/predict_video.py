import csv
import argparse
# import Models
from Models.TrackNet import TrackNet
import queue
import cv2
import numpy as np
from PIL import Image, ImageDraw

# Parse parameters
parser = argparse.ArgumentParser()
parser.add_argument("--input_video_path", type=str)
parser.add_argument("--output_video_path", type=str, default = "")
parser.add_argument("--save_weights_path", type = str)
parser.add_argument("--n_classes", type=int)

args = parser.parse_args()
input_video_path = args.input_video_path
output_video_path = args.output_video_path
save_weights_path = args.save_weights_path
n_classes = args.n_classes

if output_video_path == "":
    # Output video in same path
    output_video_path = input_video_path.split('.')[0] + "_TrackNet.mp4"

# Get video fps & size
video = cv2.VideoCapture(input_video_path)
fps = int(video.get(cv2.CAP_PROP_FPS))
output_width = int(video.get(cv2.CAP_PROP_FRAME_WIDTH))
output_height = int(video.get(cv2.CAP_PROP_FRAME_HEIGHT))

# Start from first frame
currentFrame = 0

# Width and height in TrackNet
width, height = 640, 360
img, img1, img2 = None, None, None

# Load TrackNet model
modelFN = TrackNet
m = modelFN(n_classes, input_height=height, input_width=width)
m.compile(loss='categorical_crossentropy', optimizer='adadelta', metrics=['accuracy'])
m.load_weights(save_weights_path)

# In order to draw the trajectory of tennis, we need to save the coordinate of previous 7 frames
q = queue.deque()
for i in range(0, 8):
    q.appendleft(None)

# Save prediction images as video
fourcc = cv2.VideoWriter_fourcc(*'XVID')
output_video = cv2.VideoWriter(output_video_path, fourcc, fps, (output_width, output_height))

# Both first and second frames can't be predicted, so we directly write the frames to output video
# Capture frame-by-frame
video.set(1, currentFrame)
ret, img1 = video.read()
# Write image to video
output_video.write(img1)
currentFrame += 1
# Resize it
img1 = cv2.resize(img1, (width, height))
img1 = img1.astype(np.float32)

# Capture frame-by-frame
video.set(1, currentFrame)
ret, img = video.read()
# Write image to video
output_video.write(img)
currentFrame += 1
# Resize it
img = cv2.resize(img, (width, height))
img = img.astype(np.float32)

# Open a CSV file to append ball positions (currentFrame, x, y)
with open('ball_positions.csv', mode='a', newline='') as file:
    writer = csv.writer(file)

    # Write header if the file is empty (only the first time)
    if file.tell() == 0:
        writer.writerow(['Frame', 'X_Position', 'Y_Position'])

    while(True):

        img2 = img1
        img1 = img

        # Capture frame-by-frame
        video.set(1, currentFrame)
        ret, img = video.read()

        # If there is no frame in the video, break
        if not ret:
            break

        # img is the frame that TrackNet will predict the position
        output_img = img

        # Resize it
        img = cv2.resize(img, (width, height))
        img = img.astype(np.float32)

        # Combine three images to (width, height, rgb*3)
        X = np.concatenate((img, img1, img2), axis=2)

        # Since the ordering of TrackNet is 'channels_first', we need to change the axis
        X = np.rollaxis(X, 2, 0)
        pr = m.predict(np.array([X]))[0]

        pr = pr.reshape((height, width, n_classes)).argmax(axis=2)
        pr = pr.astype(np.uint8)

        # Reshape the image size as original input image
        heatmap = cv2.resize(pr, (output_width, output_height))
        ret, heatmap = cv2.threshold(heatmap, 127, 255, cv2.THRESH_BINARY)

        # Find the circle in the image with 2 <= radius <= 7
        circles = cv2.HoughCircles(heatmap, cv2.HOUGH_GRADIENT, dp=1, minDist=1, param1=50, param2=2, minRadius=2, maxRadius=7)

        # In order to draw the circle in output_img, we need to use PIL library
        PIL_image = cv2.cvtColor(output_img, cv2.COLOR_BGR2RGB)
        PIL_image = Image.fromarray(PIL_image)

        if circles is not None:
            if len(circles) == 1:
                x = int(circles[0][0][0])
                y = int(circles[0][0][1])

                # Append currentFrame, x, and y to the CSV file
                writer.writerow([currentFrame, x, y])

                # Print current frame and coordinates
                print(currentFrame, x, y)

                # Push x, y to queue
                q.appendleft([x, y])
                q.pop()
            else:
                # Push None to queue
                q.appendleft(None)
                q.pop()
        else:
            # Push None to queue
            q.appendleft(None)
            q.pop()

        # Draw current frame prediction and previous 7 frames as yellow circles
        for i in range(0, 8):
            if q[i] is not None:
                draw_x = q[i][0]
                draw_y = q[i][1]
                bbox = (draw_x - 2, draw_y - 2, draw_x + 2, draw_y + 2)
                draw = ImageDraw.Draw(PIL_image)
                draw.ellipse(bbox, outline='yellow')
                del draw

        # Convert PIL image format back to OpenCV image format
        opencvImage = cv2.cvtColor(np.array(PIL_image), cv2.COLOR_RGB2BGR)
        # Write image to output video
        output_video.write(opencvImage)

        # Next frame
        currentFrame += 1

# Everything is done, release the video
video.release()
output_video.release()
print("Finish")
