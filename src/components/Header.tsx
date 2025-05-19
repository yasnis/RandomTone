import React from 'react';
import { headerStyle, titleStyle } from '../styles/commonStyles';

interface HeaderProps {
  title: string;
}

const Header: React.FC<HeaderProps> = ({ title }) => {
  return (
    <header style={headerStyle}>
      <h1 style={titleStyle}>{title}</h1>
    </header>
  );
};

export default Header;