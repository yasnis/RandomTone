import React from 'react';

interface FooterProps {
  copyrightText?: string;
}

const Footer: React.FC<FooterProps> = ({ copyrightText = '© 2025 RandomTone. All rights reserved.' }) => {
  return (
    <footer className="footer">
      <div>
        <div>{copyrightText}</div>
      </div>
    </footer>
  );
};

export default Footer;