import React from 'react';

export const LandingPage: React.FC = () => {
  return (
    <div className="w-full h-screen overflow-hidden bg-[#EEEEEE]">
      <iframe
        src="/landing.html"
        title="SecuAI — Build with AI. Deploy with confidence."
        className="w-full h-full border-none block"
        style={{ width: '100%', height: '100%', border: 'none' }}
      />
    </div>
  );
};

export default LandingPage;
