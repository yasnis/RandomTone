import React from 'react';

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
    <div className="settings-panel">
      <div className="settings-content">
        {/* BPMコントロール - 常に1行フル幅 */}
        <div className="settings-row">
          <div className="compact-label">BPM</div>
          <div className="bpm-container">
            <input 
              type="range" 
              min="20" 
              max="240" 
              value={bpm} 
              onChange={onBpmChange}
              className="bpm-slider"
            />
            <span className="bpm-value">{bpm}</span>
          </div>
        </div>
        
        {/* その他のコントロール - 2列グリッドレイアウト */}
        <div className="compact-controls">
          {/* 拍子コントロール */}
          <div className="compact-control-item">
            <div className="compact-label">Beat</div>
            <select 
              value={timeSignature} 
              onChange={onTimeSignatureChange}
              className="control-select"
            >
              <option value={4}>4/4</option>
              <option value={3}>3/4</option>
              <option value={6}>6/8</option>
              <option value={5}>5/4</option>
            </select>
          </div>
          
          {/* 小節数コントロール */}
          <div className="compact-control-item">
            <div className="compact-label">Measure num</div>
            <select 
              value={measureCount} 
              onChange={onMeasureCountChange}
              className="control-select"
            >
              {[1, 2, 3, 4, 5, 6, 7, 8].map(count => (
                <option key={count} value={count}>{count}</option>
              ))}
            </select>
          </div>
          
          {/* メトロノームタイプコントロール */}
          <div className="compact-control-item">
            <div className="compact-label">Type</div>
            <select 
              value={metronomeType} 
              onChange={onMetronomeTypeChange}
              className="control-select"
            >
              <option value="type1">Default</option>
              <option value="type2">Piano</option>
            </select>
          </div>
          
          {/* アタック音設定コントロール */}
          <div className="compact-control-item">
            <div className="compact-label">Attack</div>
            <label className="switch-container">
              <input 
                type="checkbox" 
                checked={useAttackSound} 
                onChange={(e) => onAttackSoundChange(e.target.checked)}
                className="switch-input"
              />
              <span className="switch-slider"></span>
            </label>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MetronomeControls;