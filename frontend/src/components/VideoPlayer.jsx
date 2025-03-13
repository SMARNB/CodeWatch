import React from "react";
import { FaPlay } from "react-icons/fa";

const VideoPlayer = () => {
  return (
    <div className="relative w-full h-80 bg-gray-300 rounded-lg flex items-center justify-center mb-6">
      <FaPlay className="text-4xl text-white cursor-pointer" />
    </div>
  );
};

export default VideoPlayer;
