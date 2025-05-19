import React from 'react';
import { controlPanelStyle, controlItemStyle, controlLabelStyle, selectStyle, sliderStyle, bpmValueStyle } from '../styles/commonStyles';

// 直接型をインラインで定義して外部依存を減らす
interface ControlState {
  bpm: number;
  timeSignature: number;
  measureCount: number;
  metronomeType: string;
  useAttackSound: boolean;
}

interface MetronomeControlsProps {
  controlState: ControlState;
  onBpmChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onTimeSignatureChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  onMeasureCountChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  onMetronomeTypeChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  onAttackSoundChange: (useAttack: boolean) => void;
}

const MetronomeControls: React.FC<MetronomeControlsProps> = ({
  controlState,
  onBpmChange,
  onTimeSignatureChange,
  onMeasureCountChange,
  onMetronomeTypeChange,
  onAttackSoundChange
}) => {
  const { bpm, timeSignature, measureCount, metronomeType, useAttackSound } = controlState;
  
  return (
    <div style={controlPanelStyle}>
      {/* BPMコントロール */}
      <div style={controlItemStyle}>
        <div style={controlLabelStyle}>BPM</div>
        <input 
          type="range" 
          min="20" 
          max="240" 
          value={bpm} 
          onChange={onBpmChange}
          style={sliderStyle}
        />
        <div style={bpmValueStyle}>{bpm}</div>
      </div>
      
      {/* 拍子コントロール */}
      <div style={controlItemStyle}>
        <div style={controlLabelStyle}>Time Signature</div>
        <select 
          value={timeSignature} 
          onChange={onTimeSignatureChange}
          style={selectStyle}
        >
          <option value={4}>4/4</option>
          <option value={3}>3/4</option>
          <option value={6}>6/8</option>
          <option value={5}>5/4</option>
        </select>
      </div>
      
      {/* 小節数コントロール */}
      <div style={controlItemStyle}>
        <div style={controlLabelStyle}>Measures per Tone</div>
        <select 
          value={measureCount} 
          onChange={onMeasureCountChange}
          style={selectStyle}
        >
          {[1, 2, 3, 4, 5, 6, 7, 8].map(count => (
            <option key={count} value={count}>{count}</option>
          ))}
        </select>
      </div>
      
      {/* メトロノームタイプコントロール */}
      <div style={controlItemStyle}>
        <div style={controlLabelStyle}>Metronome Type</div>
        <select 
          value={metronomeType} 
          onChange={onMetronomeTypeChange}
          style={selectStyle}
        >
          <option value="type1">Type 1</option>
          <option value="type2">Type 2</option>
        </select>
      </div>
      
      {/* アタック音設定コントロール */}
      <div style={controlItemStyle}>
        <div style={controlLabelStyle}>Attack Sound</div>
        <label className="switch" style={{ display: 'flex', alignItems: 'center' }}>
          <input 
            type="checkbox" 
            checked={useAttackSound} 
            onChange={(e) => onAttackSoundChange(e.target.checked)}
            style={{ marginRight: '0.5rem' }}
          />
          <span style={{ color: 'white', fontSize: '1rem' }}>
            {useAttackSound ? 'ON' : 'OFF'}
          </span>
        </label>
      </div>
    </div>
  );
};

export default MetronomeControls;