import React from "react";
import ScrollArea from "./ScrollArea";
import Card from "./Card";
import CardContent from "./Card";
import "../components/CustomCSS/VideoThumbnails.css";

const CameraThumbnail = ({ id }) => {
  return (
    <Card className="w-32 h-32 flex-shrink-0 cursor-pointer border border-gray-300 hover:border-blue-500">
      <CardContent className="flex items-center justify-center h-full bg-gray-200">
        <span className="text-gray-600">Camera {id}</span>
      </CardContent>
    </Card>
  );
};

const CameraThumbnails = () => {
  const cameras = Array.from({ length: 50 }, (_, i) => i + 1);

  return (
    <div className="w-full">
      {/* SET VERTICAL PADDING TO ZERO (py-0) and use px-2 for minimal horizontal padding */}
      <ScrollArea className="w-full overflow-x-auto border px-2 py-0 rounded-lg"> 
        <div className="flex space-x-4 w-full overflow-hidden">
          {cameras.map((id) => (
            <CameraThumbnail key={id} id={id} />
          ))}
        </div>
      </ScrollArea>
    </div>
  );
};

export default CameraThumbnails;