import React from "react";
import ScrollArea from "./ScrollArea";
import Card from "./Card";
import CardContent from "./Card";
import "../components/CustomCSS/VideoThumbnails.css";

const CameraThumbnail = ({ camera, isSelected, onSelect }) => {
    // Force image refresh on the thumbnail too
    const [timestamp, setTimestamp] = React.useState(Date.now());
    React.useEffect(() => {
        const interval = setInterval(() => setTimestamp(Date.now()), 5000);
        return () => clearInterval(interval);
    }, []);

    return (
        <Card
            className={`min-w-[200px] h-[140px] flex-shrink-0 cursor-pointer border-2 transition-all duration-200 rounded-xl overflow-hidden group relative shadow-sm ${isSelected ? 'border-indigo-600 scale-[1.05] z-10 shadow-md' : 'border-transparent hover:border-indigo-400 hover:shadow-md'}`}
            onClick={() => onSelect(camera)}
        >
            <CardContent className="flex flex-col items-center justify-center h-full w-full relative p-0">
                {/* Background Image Preview */}
                <img 
                    src={`/live_feed_${camera.camera_id}.jpg?t=${timestamp}`} 
                    alt={camera.name}
                    className="absolute inset-0 w-full h-full object-cover opacity-70 group-hover:opacity-90 transition-opacity"
                    onError={(e) => { e.target.src = '/placeholder_camera.jpg'; }}
                />
                
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent"></div>

                {/* Status Indicator */}
                <div className={`absolute top-3 right-3 w-3 h-3 rounded-full z-10 shadow-sm border border-white/20 ${camera.status === 'Active' ? 'bg-green-500' : 'bg-red-500'}`} />

                <div className="absolute bottom-3 left-3 right-3 z-10 text-left">
                    <span className="block text-white font-semibold text-[14px] truncate drop-shadow-md">{camera.name}</span>
                    <span className="block text-gray-300 font-medium text-[12px] truncate drop-shadow-md">{camera.location}</span>
                </div>
            </CardContent>
        </Card>
    );
};

const CameraThumbnails = ({ onSelectCamera, selectedCameraId }) => {
    const [cameras, setCameras] = React.useState([]);

    React.useEffect(() => {
        let isInitialFetch = true;

        const fetchCameras = async () => {
            try {
                const response = await fetch('/api/cameras/');
                if (response.ok) {
                    const data = await response.json();
                    setCameras(data);

                    // Select first camera by default if available only on initial fetch
                    if (isInitialFetch && data.length > 0 && onSelectCamera) {
                        onSelectCamera(data[0]);
                        isInitialFetch = false;
                    }
                }
            } catch (error) {
                console.error("Failed to fetch cameras:", error);
            }
        };

        fetchCameras();
        const intervalId = setInterval(fetchCameras, 5000);

        return () => clearInterval(intervalId);
    }, []);

    return (
        <div className="w-full">
            {/* Set vertical padding slightly so scaled cards don't clip */}
            <ScrollArea className="w-full overflow-x-auto border-0 px-4 py-4 min-h-[170px]">
                <div className="flex space-x-6 w-full items-center">
                    {cameras.map((cam) => (
                        <CameraThumbnail
                            key={cam.camera_id}
                            camera={cam}
                            isSelected={selectedCameraId === cam.camera_id}
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
