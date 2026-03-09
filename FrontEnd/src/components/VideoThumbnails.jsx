import React from "react";
import ScrollArea from "./ScrollArea";
import Card from "./Card";
import CardContent from "./Card";
import "../components/CustomCSS/VideoThumbnails.css";

const CameraThumbnail = ({ camera, onSelect }) => {
    return (
        <Card
            className="w-32 h-32 flex-shrink-0 cursor-pointer border border-gray-300 hover:border-blue-500 transition-colors"
            onClick={() => onSelect(camera)}
        >
            <CardContent className="flex flex-col items-center justify-center h-full bg-gray-200 relative p-2">
                {/* Status Indicator */}
                <div className={`absolute top-2 right-2 w-2 h-2 rounded-full ${camera.status === 'Active' ? 'bg-green-500' : 'bg-red-500'}`} />

                <span className="text-gray-700 font-semibold text-center text-sm">{camera.name}</span>
                <span className="text-gray-500 text-xs mt-1">{camera.location}</span>
            </CardContent>
        </Card>
    );
};

const CameraThumbnails = ({ onSelectCamera }) => {
    const [cameras, setCameras] = React.useState([]);

    React.useEffect(() => {
        const fetchCameras = async () => {
            try {
                const response = await fetch('http://127.0.0.1:8000/api/cameras/');
                if (response.ok) {
                    const data = await response.json();
                    setCameras(data);

                    // Select first camera by default if available
                    if (data.length > 0 && onSelectCamera) {
                        onSelectCamera(data[0]);
                    }
                }
            } catch (error) {
                console.error("Failed to fetch cameras:", error);
            }
        };
        fetchCameras();
    }, []);

    return (
        <div className="w-full">
            {/* SET VERTICAL PADDING TO ZERO (py-0) and use px-2 for minimal horizontal padding */}
            <ScrollArea className="w-full overflow-x-auto border px-2 py-0 rounded-lg">
                <div className="flex space-x-4 w-full overflow-hidden py-2">
                    {cameras.map((cam) => (
                        <CameraThumbnail
                            key={cam.camera_id}
                            camera={cam}
                            onSelect={onSelectCamera}
                        />
                    ))}
                    {cameras.length === 0 && (
                        <div className="p-4 text-gray-500">No cameras found.</div>
                    )}
                </div>
            </ScrollArea>
        </div>
    );
};

export default CameraThumbnails;