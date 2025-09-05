import React, { useRef, useEffect, useState } from 'react';
import { useAppStore } from '../store';
import './MapScreen.css';

const TILE_SIZE = 40;
const MAP_WIDTH = 40;
const MAP_HEIGHT = 40;

const MapScreen: React.FC = () => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const { rapport, globalData } = useAppStore();
    const [center, setCenter] = useState({ x: 20, y: 20 });

    useEffect(() => {
        if (rapport?.player.capitale) {
            const [_, y, x] = rapport.player.capitale.split('_').map(Number);
            setCenter({ x, y });
        }
    }, [rapport]);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const drawGrid = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.strokeStyle = '#444';

            for (let i = 0; i <= MAP_WIDTH; i++) {
                ctx.beginPath();
                ctx.strokeStyle = i % 20 === 0 ? '#00f' : i % 5 === 0 ? '#f00' : '#444';
                ctx.moveTo(i * TILE_SIZE, 0);
                ctx.lineTo(i * TILE_SIZE, MAP_HEIGHT * TILE_SIZE);
                ctx.stroke();
            }

            for (let i = 0; i <= MAP_HEIGHT; i++) {
                ctx.beginPath();
                ctx.strokeStyle = i % 20 === 0 ? '#00f' : i % 5 === 0 ? '#f00' : '#444';
                ctx.moveTo(0, i * TILE_SIZE);
                ctx.lineTo(MAP_WIDTH * TILE_SIZE, i * TILE_SIZE);
                ctx.stroke();
            }
        };

        const drawSystems = () => {
            const systems = [...(rapport?.player.systems || []), ...(rapport?.player.detectedSystems || [])];
            systems.forEach(system => {
                const [_, y, x] = system.pos.split('_').map(Number);
                const img = new Image();
                img.src = `/img/etoile${system.typeEtoile}.gif`;
                img.onload = () => {
                    ctx.drawImage(img, (x - 1) * TILE_SIZE, (y - 1) * TILE_SIZE, TILE_SIZE, TILE_SIZE);
                };
            });
        };

        const drawFleets = () => {
            const fleets = [...(rapport?.player.fleets || []), ...(rapport?.player.detectedFleets || [])];
            fleets.forEach(fleet => {
                const [_, y, x] = fleet.pos.split('_').map(Number);
                const img = new Image();
                img.src = `/img/flotte.png`;
                img.onload = () => {
                    ctx.drawImage(img, (x - 1) * TILE_SIZE, (y - 1) * TILE_SIZE, TILE_SIZE / 2, TILE_SIZE / 2);
                };
            });
        };

        drawGrid();
        drawSystems();
        drawFleets();

    }, [center, rapport, globalData]);

    return (
        <div className="map-screen">
            <canvas
                ref={canvasRef}
                width={MAP_WIDTH * TILE_SIZE}
                height={MAP_HEIGHT * TILE_SIZE}
            />
        </div>
    );
};

export default MapScreen;
