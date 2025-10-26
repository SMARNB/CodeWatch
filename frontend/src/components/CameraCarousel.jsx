import React, { useState } from 'react';

const CameraCarousel = ({ images = [], autoPlay = false, interval = 3000, className = '' }) => {
  const [currentIndex, setCurrentIndex] = useState(0);

  const defaultImages = [
    { id: 1, src: '/placeholder-camera-1.jpg', alt: 'Camera 1' },
    { id: 2, src: '/placeholder-camera-2.jpg', alt: 'Camera 2' },
    { id: 3, src: '/placeholder-camera-3.jpg', alt: 'Camera 3' },
    { id: 4, src: '/placeholder-camera-4.jpg', alt: 'Camera 4' },
  ];

  const slides = images.length > 0 ? images : defaultImages;

  const goToPrevious = () => {
    setCurrentIndex((prevIndex) =>
      prevIndex === 0 ? slides.length - 1 : prevIndex - 1
    );
  };

  const goToNext = () => {
    setCurrentIndex((prevIndex) =>
      prevIndex === slides.length - 1 ? 0 : prevIndex + 1
    );
  };

  React.useEffect(() => {
    if (!autoPlay) return;

    const timer = setInterval(() => {
      goToNext();
    }, interval);

    return () => clearInterval(timer);
  }, [currentIndex, autoPlay, interval]);

  return (
    <div className={`relative ${className}`}>
      {/* Carousel Container */}
      <div className="relative overflow-hidden rounded-lg bg-gray-900">
        <div className="aspect-video relative">
          {/* Images */}
          <div
            className="flex transition-transform duration-500 ease-in-out h-full"
            style={{ transform: `translateX(-${currentIndex * 100}%)` }}
          >
            {slides.map((image, index) => (
              <div
                key={image.id || index}
                className="min-w-full h-full flex-shrink-0"
              >
                <img
                  src={image.src}
                  alt={image.alt || `Slide ${index + 1}`}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    e.target.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="400" height="300"%3E%3Crect fill="%23374151" width="400" height="300"/%3E%3Ctext fill="%239CA3AF" font-family="sans-serif" font-size="18" x="50%25" y="50%25" text-anchor="middle" dy=".3em"%3ECamera Feed%3C/text%3E%3C/svg%3E';
                  }}
                />
              </div>
            ))}
          </div>

          {/* Navigation Buttons */}
          <button
            onClick={goToPrevious}
            className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 bg-white bg-opacity-90 hover:bg-opacity-100 rounded-full flex items-center justify-center shadow-lg transition-all hover:scale-110 focus:outline-none focus:ring-2 focus:ring-blue-500"
            aria-label="Previous slide"
          >
            <svg
              className="w-6 h-6 text-gray-800 rotate-180"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5l7 7-7 7"
              />
            </svg>
          </button>

          <button
            onClick={goToNext}
            className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 bg-white bg-opacity-90 hover:bg-opacity-100 rounded-full flex items-center justify-center shadow-lg transition-all hover:scale-110 focus:outline-none focus:ring-2 focus:ring-blue-500"
            aria-label="Next slide"
          >
            <svg
              className="w-6 h-6 text-gray-800"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5l7 7-7 7"
              />
            </svg>
          </button>

          {/* Slide Indicators */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex space-x-2">
            {slides.map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentIndex(index)}
                className={`w-2 h-2 rounded-full transition-all ${
                  index === currentIndex
                    ? 'bg-white w-6'
                    : 'bg-white bg-opacity-50 hover:bg-opacity-75'
                }`}
                aria-label={`Go to slide ${index + 1}`}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Slide Counter */}
      <div className="absolute top-4 right-4 bg-black bg-opacity-60 text-white text-xs font-medium px-3 py-1 rounded-full">
        {currentIndex + 1} / {slides.length}
      </div>
    </div>
  );
};

export default CameraCarousel;

