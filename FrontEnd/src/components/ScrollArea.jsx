import React, { useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

const ScrollArea = ({ children, className }) => {
  const scrollRef = useRef(null);

  const scrollLeft = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({ left: -200, behavior: "smooth" });
    }
  };

  const scrollRight = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({ left: 200, behavior: "smooth" });
    }
  };

  return (
    <div className="relative w-full flex items-center">
      <button onClick={scrollLeft} className="absolute left-0 z-10 bg-white p-2 rounded-full shadow-md">
        <ChevronLeft size={24} />
      </button>
      <div ref={scrollRef} className={`overflow-x-auto whitespace-nowrap ${className}`} style={{ scrollBehavior: "smooth", scrollbarWidth: "thin" }}>
        {children}
      </div>
      <button onClick={scrollRight} className="absolute right-0 z-10 bg-white p-2 rounded-full shadow-md">
        <ChevronRight size={24} />
      </button>
    </div>
  );
};

export default ScrollArea;