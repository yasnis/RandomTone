import React from 'react';
import { footerStyle } from '../styles/commonStyles';

interface FooterProps {
  copyrightText?: string;
}

const Footer: React.FC<FooterProps> = ({ copyrightText = '© 2025 RandomTone. All rights reserved.' }) => {
  return (
    <footer style={footerStyle}>
      <div>{copyrightText}</div>
    </footer>
  );
};

export default Footer;