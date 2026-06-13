import React, { useState } from "react";
import Navbar from "../../components/Navbar";
import StatsCard from "../../components/StatsCard";
import PieChart from "../../components/PieChart";
import LineChart from "../../components/LineChart";
import VideoPlayer from "../../components/VideoPlayer";
import AnalyticsSection from "../../components/AnalyticsSection";
import Heatmap from "../../components/Heatmap";
import Container from "../../components/Container";
import Sidebar from "../../components/Sidebar";  
import '../../components/CustomCSS/AdminHome.css';
import CameraThumbnail from '../../components/VideoThumbnails';

const AdminHome = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const toggleSidebar = () => {
    setIsSidebarOpen((prev) => !prev);
  };

  return (
    <Container>
      <div className="dashboard-container">
        <Sidebar isOpen={isSidebarOpen} onClose={toggleSidebar} />
        <div className={`dashboard-content ${isSidebarOpen ? "open" : "collapsed"}`}>
          <Navbar className="MyNav" toggleSidebar={toggleSidebar} />
          <div className="p-2 space-y-3 flex flex-col sm:grid-cols-4">
            <div className="MyCards grid sm:grid-cols-2 md:grid-cols-4 items-center gap-4 sm:gap-2">
              <StatsCard title="Title Here" value="15,565" percentage="+5%" increase />
              <StatsCard title="Title Here" value="9,454" percentage="-5%" />
              <StatsCard title="Title Here" value="15,565" percentage="+5%" increase />
              <StatsCard title="Title Here" value="9,454" percentage="-5%" />
            </div>

            <div className="grid  sm:grid-cols-8 gap-2">
              <div className="chart-container">
                <PieChart />
              </div>
              <div className="chart-container2">
                <LineChart />
              </div>
            </div>

            <div className="video-container">
              <div><CameraThumbnail /></div><br />
            </div>
            <div className="video-container2">
            <VideoPlayer />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <AnalyticsSection title="Chart Title" value="5,000.00" />
              <Heatmap />
            </div>
          </div>
        </div>
      </div>
    </Container>
  );
};

export default AdminHome;
