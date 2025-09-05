import React, { useEffect, useRef, useState } from 'react';
import { Rapport, GlobalData, Commandant } from '../models/types';
import './MapScreen.css';

interface MapScreenProps {
  rapport: Rapport;
  globalData: GlobalData;
}

const MAP_WIDTH = 40;
const MAP_HEIGHT = 40;
const HEADER_SIZE = 30;

const parsePosition = (pos: string) => {
  const parts = pos.split('_');
  return {
    galaxy: parseInt(parts[0]),
    y: parseInt(parts[1]), // As per spec, Y is horizontal
    x: parseInt(parts[2]), // As per spec, X is vertical
  };
};

const getOwnerColor = (ownerId: string, player: Commandant): string => {
    if (ownerId === player.numero) {
        return 'green';
    }
    if (player.ALLIANCE && player.ALLIANCE.COM.some(c => c.num === ownerId)) {
        return 'blue';
    }
    if (player.PNA && player.PNA.P.some(p => p.com === ownerId)) {
        return 'yellow';
    }
    return 'red';
};

const MapScreen: React.FC<MapScreenProps> = ({ rapport, globalData }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const commandant = rapport.COMMANDANT;

  const getCapitalCoords = () => {
    if (commandant.capitale) {
      const { x, y } = parsePosition(commandant.capitale);
      return { x, y };
    }
    return { x: 20, y: 20 };
  };

  const [center, setCenter] = useState(getCapitalCoords());
  const [cellSize, setCellSize] = useState(30);
  const [selectedCell, setSelectedCell] = useState<{x: number, y: number} | null>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      e.preventDefault();
      const step = e.ctrlKey ? 5 : 1;
      setCenter(prev => {
        let newX = prev.x;
        let newY = prev.y;
        switch (e.key) {
          case 'ArrowUp':
            newX = (prev.x - step -1 + MAP_HEIGHT) % MAP_HEIGHT +1;
            break;
          case 'ArrowDown':
            newX = (prev.x + step -1 + MAP_HEIGHT) % MAP_HEIGHT +1;
            break;
          case 'ArrowLeft':
            newY = (prev.y - step -1 + MAP_WIDTH) % MAP_WIDTH +1;
            break;
          case 'ArrowRight':
            newY = (prev.y + step -1 + MAP_WIDTH) % MAP_WIDTH +1;
            break;
          default:
            return prev;
        }
        return { x: newX, y: newY };
      });
    };

    window.addEventListener('keydown', handleKeyDown);

    const handleClick = (e: MouseEvent) => {
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        if (x < HEADER_SIZE || y < HEADER_SIZE) return;

        const numCols = Math.floor((canvas.width - HEADER_SIZE) / cellSize);
        const numRows = Math.floor((canvas.height - HEADER_SIZE) / cellSize);
        const startX = Math.floor(center.x - numCols / 2);
        const startY = Math.floor(center.y - numRows / 2);

        const clickedCol = Math.floor((x - HEADER_SIZE) / cellSize);
        const clickedRow = Math.floor((y - HEADER_SIZE) / cellSize);

        const mapX = (startY + clickedRow -1 + MAP_HEIGHT) % MAP_HEIGHT + 1;
        const mapY = (startX + clickedCol -1 + MAP_WIDTH) % MAP_WIDTH + 1;

        setSelectedCell({ x: mapX, y: mapY });
    };

    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.addEventListener('click', handleClick);

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = 'black';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const numCols = Math.floor((canvas.width - HEADER_SIZE) / cellSize);
    const numRows = Math.floor((canvas.height - HEADER_SIZE) / cellSize);
    const startX = Math.floor(center.x - numCols / 2);
    const startY = Math.floor(center.y - numRows / 2);

    const drawGrid = () => {
        // ... (drawing logic is the same, so keeping it concise)
        for (let i = 0; i <= numCols; i++) {
            const x = HEADER_SIZE + i * cellSize;
            const col = (startX + i - 1 + MAP_WIDTH) % MAP_WIDTH + 1;
            if (col % 20 === 0) ctx.strokeStyle = 'darkblue';
            else if (col % 5 === 0) ctx.strokeStyle = 'darkred';
            else ctx.strokeStyle = '#444';
            ctx.beginPath();
            ctx.moveTo(x, HEADER_SIZE);
            ctx.lineTo(x, canvas.height);
            ctx.stroke();
            ctx.fillStyle = 'white';
            ctx.textAlign = 'center';
            ctx.fillText(col.toString(), x - cellSize / 2, HEADER_SIZE / 2);
        }
        for (let i = 0; i <= numRows; i++) {
            const y = HEADER_SIZE + i * cellSize;
            const row = (startY + i - 1 + MAP_HEIGHT) % MAP_HEIGHT + 1;
            if (row % 20 === 0) ctx.strokeStyle = 'darkblue';
            else if (row % 5 === 0) ctx.strokeStyle = 'darkred';
            else ctx.strokeStyle = '#444';
            ctx.beginPath();
            ctx.moveTo(HEADER_SIZE, y);
            ctx.lineTo(canvas.width, y);
            ctx.stroke();
            ctx.fillStyle = 'white';
            ctx.textAlign = 'center';
            ctx.fillText(row.toString(), HEADER_SIZE / 2, y - cellSize / 2);
        }
    };

    const drawSystems = () => {
        const allSystems = [
            ...commandant.SYSTEMES.S.map(s => ({...s, owner: commandant.numero})),
            ...commandant.DETECTIONS.SYSTEME.map(s => ({...s, owner: s.PROPRIO['#text']}))
        ];

        allSystems.forEach(system => {
            const pos = parsePosition(system.pos);
            const screenX = (pos.y - startX + MAP_WIDTH) % MAP_WIDTH;
            const screenY = (pos.x - startY + MAP_HEIGHT) % MAP_HEIGHT;

            const canvasX = HEADER_SIZE + screenX * cellSize;
            const canvasY = HEADER_SIZE + screenY * cellSize;

            if (canvasX > canvas.width || canvasY > canvas.height) return;

            const img = new Image();
            img.src = `/img/etoile${system.typeEtoile}.gif`;
            img.onload = () => {
                ctx.drawImage(img, canvasX, canvasY, cellSize, cellSize);
                ctx.strokeStyle = getOwnerColor(system.owner, commandant);
                ctx.lineWidth = 2;
                ctx.strokeRect(canvasX, canvasY, cellSize, cellSize);
            };
        });
    };

    const drawFleets = () => {
        const allFleets = [
            ...commandant.FLOTTES.F.map(f => ({...f, owner: commandant.numero})),
            ...commandant.DETECTIONS.FLOTTE.map(f => ({...f, owner: f.proprio}))
        ];

        allFleets.forEach(fleet => {
            const pos = parsePosition(fleet.pos);
            const screenX = (pos.y - startX + MAP_WIDTH) % MAP_WIDTH;
            const screenY = (pos.x - startY + MAP_HEIGHT) % MAP_HEIGHT;

            const canvasX = HEADER_SIZE + screenX * cellSize;
            const canvasY = HEADER_SIZE + screenY * cellSize;

            if (canvasX > canvas.width || canvasY > canvas.height) return;

            const img = new Image();
            img.src = '/img/flotte.png';
            img.onload = () => {
                const fleetSize = cellSize / 2;
                const fleetX = canvasX + cellSize - fleetSize;
                const fleetY = canvasY;
                ctx.drawImage(img, fleetX, fleetY, fleetSize, fleetSize);
                ctx.strokeStyle = getOwnerColor(fleet.owner, commandant);
                ctx.lineWidth = 2;
                ctx.strokeRect(fleetX, fleetY, fleetSize, fleetSize);
            };
        });
    };

    drawGrid();
    drawSystems();
    drawFleets();

    if (selectedCell) {
        const screenX = (selectedCell.y - startX + MAP_WIDTH) % MAP_WIDTH;
        const screenY = (selectedCell.x - startY + MAP_HEIGHT) % MAP_HEIGHT;
        const canvasX = HEADER_SIZE + screenX * cellSize;
        const canvasY = HEADER_SIZE + screenY * cellSize;

        ctx.strokeStyle = 'yellow';
        ctx.lineWidth = 3;
        ctx.strokeRect(canvasX, canvasY, cellSize, cellSize);
    }

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      canvas.removeEventListener('click', handleClick);
    };

  }, [center, cellSize, rapport, globalData, selectedCell, commandant]);

  const getSelectedCellInfo = () => {
    if (!selectedCell) return null;

    const allSystems = [
        ...commandant.SYSTEMES.S.map(s => ({...s, owner: commandant.numero})),
        ...commandant.DETECTIONS.SYSTEME.map(s => ({...s, owner: s.PROPRIO['#text']}))
    ];
    const system = allSystems.find(s => {
        const pos = parsePosition(s.pos);
        return pos.x === selectedCell.x && pos.y === selectedCell.y;
    });

    const allFleets = [
        ...commandant.FLOTTES.F.map(f => ({...f, owner: commandant.numero})),
        ...commandant.DETECTIONS.FLOTTE.map(f => ({...f, owner: f.proprio}))
    ];
    const fleets = allFleets.filter(f => {
        const pos = parsePosition(f.pos);
        return pos.x === selectedCell.x && pos.y === selectedCell.y;
    });

    return (
        <div>
            <h4>Coordonnées: {selectedCell.x}-{selectedCell.y}</h4>
            {system && <div><h5>Système: {system.nom}</h5></div>}
            {fleets.length > 0 && (
                <div>
                    <h5>Flottes:</h5>
                    <ul>
                        {fleets.map(f => <li key={f.num}>{f.nom}</li>)}
                    </ul>
                </div>
            )}
        </div>
    );
  };

  return (
    <div className="map-screen">
      <div className="map-container">
        <canvas ref={canvasRef} id="map-canvas" width="1000" height="800"></canvas>
      </div>
      <div className="info-panel">
        <h3>Informations</h3>
        <p>Centre: {center.x}, {center.y}</p>
        <div>
          <label>Cell Size:</label>
          <input
            type="range"
            min="10"
            max="100"
            value={cellSize}
            onChange={(e) => setCellSize(parseInt(e.target.value))}
          />
          <span>{cellSize}</span>
        </div>
        {getSelectedCellInfo()}
      </div>
    </div>
  );
};

export default MapScreen;
