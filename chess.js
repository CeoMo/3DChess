// Helper function to compare Babylon.js Color3 objects
function colorsEqual(c1, c2) {
    return Math.abs(c1.r - c2.r) < 0.0001 &&
           Math.abs(c1.g - c2.g) < 0.0001 &&
           Math.abs(c1.b - c2.b) < 0.0001;
}

// Initialize Babylon.js
const canvas = document.getElementById("renderCanvas");
const engine = new BABYLON.Engine(canvas, true);
let currentTurn = "white"; // Track whose turn it is

const themes = [
    {
        light: new BABYLON.Color3(1, 1, 1),
        dark: new BABYLON.Color3(0.2, 0.2, 0.2),
    },
    {
        light: new BABYLON.Color3(0.9, 0.9, 0.6),
        dark: new BABYLON.Color3(0.3, 0.2, 0.1),
    },
    {
        light: new BABYLON.Color3(0.6, 0.8, 1),
        dark: new BABYLON.Color3(0.2, 0.4, 0.6),
    },
];
let currentThemeIndex = 0;

let gameOver = false;

const boardSize = 8;
const pieces = [];
let selectedPiece = null;
let validMoves = [];

// Define isTileOccupied function
const isTileOccupied = (x, z) => {
    return pieces.some((p) => p.position.x === x && p.position.z === z);
};

// Define a function to clear highlights when a piece is deselected
const clearHighlights = () => {
    if (selectedPiece && selectedPiece.material) {
        selectedPiece.material.emissiveColor = new BABYLON.Color3(0, 0, 0);
    }
    selectedPiece = null;
    validMoves = [];
};

// Define the getValidMoves function
const getValidMoves = (piece, pieces, boardSize) => {
    const validMoves = [];
    const { type, color } = piece.metadata;
    const position = piece.position.clone();

    switch (type) {
        case "pawn":
            // Very simplified: pawns move one step forward if free
            // White moves in negative z, black moves in positive z
            let direction = (color === "white") ? -1 : 1;
            const targetZ = position.z + direction;
            if (
                targetZ >= -3.5 &&
                targetZ <= 3.5 &&
                !isTileOccupied(position.x, targetZ)
            ) {
                validMoves.push(new BABYLON.Vector3(position.x, 0, targetZ));
            }
            break;

        case "rook":
            // Horizontal and vertical
            const directionsRook = [
                { dx: 1, dz: 0 },
                { dx: -1, dz: 0 },
                { dx: 0, dz: 1 },
                { dx: 0, dz: -1 },
            ];
            directionsRook.forEach(({ dx, dz }) => {
                for (let i = 1; i < boardSize; i++) {
                    const targetX = position.x + dx * i;
                    const targetZ = position.z + dz * i;
                    if (
                        targetX < -3.5 ||
                        targetX > 3.5 ||
                        targetZ < -3.5 ||
                        targetZ > 3.5
                    ) {
                        break;
                    }
                    if (isTileOccupied(targetX, targetZ)) {
                        // Stop if blocked
                        break;
                    }
                    validMoves.push(new BABYLON.Vector3(targetX, 0, targetZ));
                }
            });
            break;

        case "knight":
            // L-shaped moves
            [
                { x: 2, z: 1 },
                { x: 2, z: -1 },
                { x: -2, z: 1 },
                { x: -2, z: -1 },
                { x: 1, z: 2 },
                { x: 1, z: -2 },
                { x: -1, z: 2 },
                { x: -1, z: -2 },
            ].forEach(({ x, z }) => {
                const targetX = position.x + x;
                const targetZ = position.z + z;
                if (
                    targetX >= -3.5 &&
                    targetX <= 3.5 &&
                    targetZ >= -3.5 &&
                    targetZ <= 3.5 &&
                    !isTileOccupied(targetX, targetZ)
                ) {
                    validMoves.push(new BABYLON.Vector3(targetX, 0, targetZ));
                }
            });
            break;

        case "bishop":
            // Diagonal moves
            const directionsBishop = [
                { dx: 1, dz: 1 },
                { dx: 1, dz: -1 },
                { dx: -1, dz: 1 },
                { dx: -1, dz: -1 },
            ];
            directionsBishop.forEach(({ dx, dz }) => {
                for (let i = 1; i < boardSize; i++) {
                    const targetX = position.x + dx * i;
                    const targetZ = position.z + dz * i;
                    if (
                        targetX < -3.5 ||
                        targetX > 3.5 ||
                        targetZ < -3.5 ||
                        targetZ > 3.5
                    ) {
                        break;
                    }
                    if (isTileOccupied(targetX, targetZ)) {
                        // Blocked by piece
                        break;
                    }
                    validMoves.push(new BABYLON.Vector3(targetX, 0, targetZ));
                }
            });
            break;

        case "queen":
            // Combine rook and bishop moves
            getValidMoves({ position, metadata: { type: "rook", color } }, pieces, boardSize).forEach((move) => validMoves.push(move));
            getValidMoves({ position, metadata: { type: "bishop", color } }, pieces, boardSize).forEach((move) => validMoves.push(move));
            break;

        case "king":
            // One square in any direction
            for (let dx = -1; dx <= 1; dx++) {
                for (let dz = -1; dz <= 1; dz++) {
                    if (dx !== 0 || dz !== 0) {
                        const targetX = position.x + dx;
                        const targetZ = position.z + dz;
                        if (
                            targetX >= -3.5 &&
                            targetX <= 3.5 &&
                            targetZ >= -3.5 &&
                            targetZ <= 3.5 &&
                            !isTileOccupied(targetX, targetZ)
                        ) {
                            validMoves.push(new BABYLON.Vector3(targetX, 0, targetZ));
                        }
                    }
                }
            }
            break;

        default:
            console.error(`Invalid piece type: ${type}`);
    }

    return validMoves;
};

const checkForCheck = (king, pieces) => {
    // Very simplified: just checks mesh intersections (not accurate chess logic)
    for (const piece of pieces) {
        if (piece.metadata.color !== king.metadata.color) {
            if (piece.intersectsMesh(king, false)) {
                return true;
            }
        }
    }
    return false;
};

const checkForCheckmate = (king, pieces) => {
    // Very simplified logic
    const originalPosition = king.position.clone();
    if (!checkForCheck(king, pieces)) {
        return false;
    }

    for (let x = -1; x <= 1; x++) {
        for (let z = -1; z <= 1; z++) {
            if (x !== 0 || z !== 0) {
                king.position = originalPosition.add(new BABYLON.Vector3(x, 0, z));
                if (!isTileOccupied(king.position.x, king.position.z) && !checkForCheck(king, pieces)) {
                    king.position = originalPosition;
                    return false;
                }
                king.position = originalPosition;
            }
        }
    }
    return true;
};

const createScene = () => {
    const scene = new BABYLON.Scene(engine);

    // Camera
    const camera = new BABYLON.ArcRotateCamera(
        "camera",
        -Math.PI / 2,
        Math.PI / 2.5,
        15,
        BABYLON.Vector3.Zero(),
        scene
    );
    camera.attachControl(canvas, true);

    // Light
    const light = new BABYLON.HemisphericLight(
        "light",
        new BABYLON.Vector3(0, 1, 0),
        scene
    );

    // Chessboard setup
    const tileSize = 1;
    const tiles = [];

    const createOrUpdateTiles = () => {
        const colors = themes[currentThemeIndex];

        for (let row = 0; row < boardSize; row++) {
            tiles[row] = tiles[row] || [];
            for (let col = 0; col < boardSize; col++) {
                let tile = tiles[row][col];
                if (!tile) {
                    tile = BABYLON.MeshBuilder.CreateBox(
                        `tile${row}_${col}`,
                        { size: tileSize, height: 0.2 },
                        scene
                    );
                    tile.position = new BABYLON.Vector3(
                        row - boardSize / 2 + 0.5,
                        0,
                        col - boardSize / 2 + 0.5
                    );
                    tiles[row][col] = tile;
                }
                const tileMaterial =
                    tile.material ||
                    new BABYLON.StandardMaterial(
                        `tileMat${row}_${col}`,
                        scene
                    );
                tileMaterial.diffuseColor =
                    (row + col) % 2 === 0 ? colors.light : colors.dark;
                tile.material = tileMaterial;
            }
        }
    };

    createOrUpdateTiles();

    // Add turn indicator
    const turnIndicator = document.createElement("div");
    turnIndicator.style.position = "absolute";
    turnIndicator.style.top = "10px";
    turnIndicator.style.right = "10px";
    turnIndicator.style.color = "white";
    turnIndicator.style.fontSize = "20px";
    turnIndicator.style.padding = "10px";
    turnIndicator.style.background = "rgba(0, 0, 0, 0.5)";
    turnIndicator.style.borderRadius = "5px";
    turnIndicator.innerText = `Current Turn: ${currentTurn}`;
    document.body.appendChild(turnIndicator);

    const updateTurnIndicator = (message = null) => {
        turnIndicator.innerText = message || `Current Turn: ${currentTurn}`;
    };

    // Add reset button
    const resetButton = document.createElement("button");
    resetButton.innerText = "Reset Game";
    resetButton.style.position = "absolute";
    resetButton.style.bottom = "10px";
    resetButton.style.left = "10px";
    resetButton.style.padding = "10px 20px";
    resetButton.style.background = "#f44336";
    resetButton.style.color = "white";
    resetButton.style.border = "none";
    resetButton.style.borderRadius = "5px";
    resetButton.style.cursor = "pointer";
    resetButton.style.boxShadow = "0 4px 6px rgba(0, 0, 0, 0.1)";
    resetButton.onclick = () => {
        createPieces();
        currentTurn = "white";
        gameOver = false;
        updateTurnIndicator();
        clearHighlights();
    };
    document.body.appendChild(resetButton);

    // Add change theme button
    const themeButton = document.createElement("button");
    themeButton.innerText = "Change Theme";
    themeButton.style.position = "absolute";
    themeButton.style.bottom = "10px";
    themeButton.style.left = "150px";
    themeButton.style.padding = "10px 20px";
    themeButton.style.background = "#4CAF50";
    themeButton.style.color = "white";
    themeButton.style.border = "none";
    themeButton.style.borderRadius = "5px";
    themeButton.style.cursor = "pointer";
    themeButton.style.boxShadow = "0 4px 6px rgba(0, 0, 0, 0.1)";
    themeButton.onclick = () => {
        currentThemeIndex = (currentThemeIndex + 1) % themes.length;
        createOrUpdateTiles();
        // Recreate pieces so their colors match the new theme
        createPieces();
    };
    document.body.appendChild(themeButton);

    const createPiece = (type, position, color) => {
        let piece;
        switch (type) {
            case "pawn":
                piece = BABYLON.MeshBuilder.CreateSphere(
                    type,
                    { diameter: 0.5 },
                    scene
                );
                break;
            case "rook":
                piece = BABYLON.MeshBuilder.CreateBox(
                    type,
                    { size: 0.7 },
                    scene
                );
                break;
            case "knight":
                piece = BABYLON.MeshBuilder.CreateCylinder(
                    type,
                    { diameter: 0.5, height: 1 },
                    scene
                );
                break;
            case "bishop":
                piece = BABYLON.MeshBuilder.CreateTorus(
                    type,
                    { diameter: 0.7, thickness: 0.15 },
                    scene
                );
                break;
            case "queen":
                piece = BABYLON.MeshBuilder.CreateCylinder(
                    type,
                    { diameter: 0.8, height: 1.5 },
                    scene
                );
                break;
            case "king":
                piece = BABYLON.MeshBuilder.CreateCylinder(
                    `${type}Body`,
                    { diameter: 0.8, height: 1.2 },
                    scene
                );
                const crown = BABYLON.MeshBuilder.CreateTorus(
                    `${type}Crown`,
                    { diameter: 1, thickness: 0.2 },
                    scene
                );
                crown.parent = piece;
                crown.position.y = 0.8;

                const crownMaterial = new BABYLON.StandardMaterial(
                    `${type}CrownMat`,
                    scene
                );
                // Use colorsEqual to determine crown color
                if (colorsEqual(color, themes[currentThemeIndex].light)) {
                    crownMaterial.diffuseColor = new BABYLON.Color3(1, 1, 1);
                } else {
                    crownMaterial.diffuseColor = new BABYLON.Color3(0, 0, 0);
                }
                crown.material = crownMaterial;
                break;
            default:
                console.error(`Unknown piece type: ${type}`);
                return null;
        }

        piece.position = position;

        const pieceMaterial = new BABYLON.StandardMaterial(
            `${type}Mat`,
            scene
        );
        pieceMaterial.diffuseColor = color;
        piece.material = pieceMaterial;

        piece.metadata = {
            type: type,
            color: colorsEqual(color, themes[currentThemeIndex].light) ? "white" : "black",
        };

        pieces.push(piece);
        return piece;
    };

    const createPieces = () => {
        pieces.forEach((piece) => piece.dispose());
        pieces.length = 0;

        const currentTheme = themes[currentThemeIndex];

        // Pawns
        for (let i = 0; i < boardSize; i++) {
            createPiece(
                "pawn",
                new BABYLON.Vector3(i - boardSize / 2 + 0.5, 0.5, -2.5),
                currentTheme.light
            );
            createPiece(
                "pawn",
                new BABYLON.Vector3(i - boardSize / 2 + 0.5, 0.5, 2.5),
                currentTheme.dark
            );
        }

        // Rooks
        createPiece(
            "rook",
            new BABYLON.Vector3(-3.5, 0.5, -3.5),
            currentTheme.light
        );
        createPiece(
            "rook",
            new BABYLON.Vector3(3.5, 0.5, -3.5),
            currentTheme.light
        );
        createPiece(
            "rook",
            new BABYLON.Vector3(-3.5, 0.5, 3.5),
            currentTheme.dark
        );
        createPiece(
            "rook",
            new BABYLON.Vector3(3.5, 0.5, 3.5),
            currentTheme.dark
        );

        // Knights
        createPiece(
            "knight",
            new BABYLON.Vector3(-2.5, 0.5, -3.5),
            currentTheme.light
        );
        createPiece(
            "knight",
            new BABYLON.Vector3(2.5, 0.5, -3.5),
            currentTheme.light
        );
        createPiece(
            "knight",
            new BABYLON.Vector3(-2.5, 0.5, 3.5),
            currentTheme.dark
        );
        createPiece(
            "knight",
            new BABYLON.Vector3(2.5, 0.5, 3.5),
            currentTheme.dark
        );

        // Bishops
        createPiece(
            "bishop",
            new BABYLON.Vector3(-1.5, 0.5, -3.5),
            currentTheme.light
        );
        createPiece(
            "bishop",
            new BABYLON.Vector3(1.5, 0.5, -3.5),
            currentTheme.light
        );
        createPiece(
            "bishop",
            new BABYLON.Vector3(-1.5, 0.5, 3.5),
            currentTheme.dark
        );
        createPiece(
            "bishop",
            new BABYLON.Vector3(1.5, 0.5, 3.5),
            currentTheme.dark
        );

        // Queens
        createPiece(
            "queen",
            new BABYLON.Vector3(-0.5, 0.5, -3.5),
            currentTheme.light
        );
        createPiece(
            "queen",
            new BABYLON.Vector3(-0.5, 0.5, 3.5),
            currentTheme.dark
        );

        // Kings
        createPiece(
            "king",
            new BABYLON.Vector3(0.5, 0.5, -3.5),
            currentTheme.light
        );
        createPiece(
            "king",
            new BABYLON.Vector3(0.5, 0.5, 3.5),
            currentTheme.dark
        );
    };

    createPieces();

    const selectPiece = (piece) => {
        // Clarify conditions for selecting a piece
        if (pieces.includes(piece) &&
            ((piece.metadata.color === "white" && currentTurn === "white") ||
             (piece.metadata.color === "black" && currentTurn === "black"))) {
            clearHighlights();
            selectedPiece = piece;
            piece.material.emissiveColor = new BABYLON.Color3(0, 1, 0); // Highlight selected piece
            validMoves = getValidMoves(selectedPiece, pieces, boardSize);
        }
    };

    scene.onPointerObservable.add((pointerInfo) => {
        if (gameOver) return;

        switch (pointerInfo.type) {
            case BABYLON.PointerEventTypes.POINTERPICK:
                const pickedMesh = pointerInfo.pickInfo.pickedMesh;

                // If a piece is picked
                if (pickedMesh && pieces.includes(pickedMesh)) {
                    selectPiece(pickedMesh);
                } else if (selectedPiece && pickedMesh) {
                    // Check if the picked location is a valid move
                    const moveIsValid = validMoves.some((vm) => {
                        return vm.x === pickedMesh.position.x && vm.z === pickedMesh.position.z;
                    });

                    if (moveIsValid) {
                        selectedPiece.position = pickedMesh.position.clone();

                        const opposingKing = pieces.find(
                            (p) => p.metadata.type === "king" && p.metadata.color !== selectedPiece.metadata.color
                        );

                        if (opposingKing && checkForCheck(opposingKing, pieces)) {
                            if (checkForCheckmate(opposingKing, pieces)) {
                                updateTurnIndicator(`Checkmate! ${currentTurn} wins!`);
                                gameOver = true;
                            } else {
                                updateTurnIndicator(`${currentTurn === "white" ? "Black" : "White"} king is in check!`);
                            }
                        } else {
                            currentTurn = currentTurn === "white" ? "black" : "white";
                            updateTurnIndicator();
                        }

                        clearHighlights();
                    } else {
                        // Not a valid move, just clear selection
                        clearHighlights();
                    }
                }
                break;
        }
    });

    return scene;
};

const scene = createScene();

// Start the render loop
engine.runRenderLoop(() => {
    scene.render();
});

// Resize the engine on window resize
window.addEventListener("resize", () => {
    engine.resize();
});
