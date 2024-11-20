"use client";

import { useRef, useState, useEffect } from 'react';
import Select from 'react-select';
import Tesseract from 'tesseract.js';
import recipeData from '../recipes.json';

export default function Home() {
    const [cameraOn, setCameraOn] = useState(false);
    const [loadingOCR, setLoadingOCR] = useState(false);
    const [recognizedText, setRecognizedText] = useState('');
    const [drinkFound, setDrinkFound] = useState(false);
    const videoRef = useRef(null);

    const [drink, setDrink] = useState(null);
    const [size, setSize] = useState(null);
    const [iceLevel, setIceLevel] = useState(null);
    const [sugarLevel, setSugarLevel] = useState(null);
    const [toppings, setToppings] = useState([]);
    const [recipe, setRecipe] = useState('');
    const drinkOptions = Object.keys(recipeData.recipes).map(key => ({
        value: key,
        label: recipeData.recipes[key].name
    }));

    const globalIceLevels = recipeData.globalOptions.validIceLevels;
    const globalSugarLevels = recipeData.globalOptions.validSugarLevels;
    const globalToppings = recipeData.globalOptions.validToppings;

    const [availableIceLevels, setAvailableIceLevels] = useState(globalIceLevels);
    const [availableSugarLevels, setAvailableSugarLevels] = useState(globalSugarLevels);
    const [availableToppings, setAvailableToppings] = useState(globalToppings);

    const iceLevelMappings = {
        "no ice": 0,
        "light ice": 25,
        "half ice": 50,
        "less ice": 75,
        "regular ice": 100
    };

    const sugarLevelMappings = {
        "no sugar": 0,
        "light sugar": 25,
        "half sugar": 50,
        "less sugar": 75,
        "regular sugar": 100
    };

    useEffect(() => {
        if (drink) {
            const selectedRecipe = recipeData.recipes[drink.value];
            setAvailableIceLevels(selectedRecipe.validIceLevels || globalIceLevels);
            setAvailableSugarLevels(selectedRecipe.validSugarLevels || globalSugarLevels);
            setAvailableToppings(selectedRecipe.validToppings || globalToppings);
        } else {
            setAvailableIceLevels(globalIceLevels);
            setAvailableSugarLevels(globalSugarLevels);
            setAvailableToppings(globalToppings);
        }
    }, [drink]);

    const handleUseCamera = async () => {
        setCameraOn(true);
        setLoadingOCR(false);
        setDrinkFound(false);

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video:{ facingMode: { exact: "environment" } } });
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                videoRef.current.play();
            }
        } catch (error) {
            console.error("Camera access failed:", error);
            setCameraOn(false);
        }
    };

    const stopCamera = () => {
        setCameraOn(false);
        const stream = videoRef.current?.srcObject;
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
        }
    };

    // Process recognized text to fill variables
    const processOCRText = (text) => {
        const normalizedText = text.toLowerCase();

        // Check for drink key in the normalized text
        Object.keys(recipeData.recipes).forEach(key => {
            const recipeName = recipeData.recipes[key].name.toLowerCase(); // Convert recipe name to lowercase for comparison
            if (normalizedText.includes(recipeName)) {
                setDrink({ value: key, label: recipeData.recipes[key].name });
                //calculateRecipe
                return; // Exit loop once a match is found
            }
        });

        // Check for size
        if (text.includes("medium")) setSize("Medium");
        if (text.includes("large")) setSize("Large");

        // Check for ice level using mapped phrases
        Object.keys(iceLevelMappings).forEach(label => {
            if (normalizedText.includes(label)) {
                setIceLevel(iceLevelMappings[label]);
            }
        });

        // Check for sugar level using mapped phrases
        Object.keys(sugarLevelMappings).forEach(label => {
            if (normalizedText.includes(label)) {
                setSugarLevel(sugarLevelMappings[label]);
            }
        });

        // Check for toppings
        const detectedToppings = globalToppings.filter(topping => text.includes(topping.toLowerCase()));
        setToppings(detectedToppings);
    };
    useEffect(() => {
        if (drink && size && iceLevel !== null && sugarLevel !== null) {
            setDrinkFound(true);
            calculateRecipe();
            stopCamera();
        }
    }, [drink, size, iceLevel, sugarLevel]); // Trigger when all these values are set


    const scanFrame = () => {
        console.log("scanFrame started");

        if (!cameraOn || loadingOCR || drinkFound) return;

        const canvas = document.createElement("canvas");
        const video = videoRef.current;

        if (video) {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            const ctx = canvas.getContext("2d");
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

            setLoadingOCR(true);

            Tesseract.recognize(canvas, 'eng')
                .then(({ data: { text } }) => {
                    console.log("OCR text:", text);
                    setLoadingOCR(false);
                    setRecognizedText(text);
                    processOCRText(text);
                })
                .catch(error => {
                    console.error("OCR failed:", error);
                    setLoadingOCR(false);
                });
        }
    };

    useEffect(() => {
        if (cameraOn) {
            const intervalId = setInterval(scanFrame, 1000);
            return () => clearInterval(intervalId);
        }
    }, [cameraOn]);

    const calculateRecipe = () => {
        if (!drink || !size || iceLevel === null || sugarLevel === null) {
            setRecipe("Please select all required fields: drink, size, ice level, and sugar level.");
            return; // Exit the function if any required field is missing
        }

        const selectedDrink = recipeData.recipes[drink.value];
        const format = selectedDrink.format || recipeData.baseFormat;

        if (!format) {
            setRecipe("Recipe format not found");
            return;
        }

        // Determine the build format
        const build = selectedDrink.build ? (recipeData.baseBuilds[selectedDrink.build] || selectedDrink.build) : null;

        let ingredients;
        if (toppings.length === 0) {
            ingredients = selectedDrink.ingredients[size]["withoutTopping"];
        } else {
            ingredients = selectedDrink.ingredients[size]["withTopping"];
        }
        // Apply ice level adjustments
        if (iceLevel <= 50 && selectedDrink.ingredients.adjustments) {
            const adjustments = selectedDrink.ingredients.adjustments;

            // Apply each adjustment, resolving references to globalAdjustments if needed
            Object.keys(adjustments).forEach(key => {
                const adjustmentValue = adjustments[key];
                const resolvedValue = typeof adjustmentValue === "string" && adjustmentValue.startsWith("globalAdjustments.")
                                      ? recipeData.globalAdjustments[adjustmentValue.split(".")[1]] || 0
                                      : adjustmentValue;

                ingredients[key] = (ingredients[key] || 0) + resolvedValue;
            });
        }
        // Calculate sugar adjustment based on sugar level
        const availableSugarLevels = selectedDrink.validSugarLevels || recipeData.globalOptions.validSugarLevels;
        const maxSugarLevel = Math.max(...availableSugarLevels);
        const minSugarLevel = Math.min(...availableSugarLevels);

        // Calculate how many steps down from max the chosen sugar level is
        const stepCount = (maxSugarLevel - sugarLevel) / (maxSugarLevel - minSugarLevel) * (availableSugarLevels.length - 1);
        const sugarAdjustment = -5 * stepCount;
        const finalSugar = (ingredients.sugar || 0) + sugarAdjustment;

        // Prepare each ingredient part
        const flowerTea = ingredients.flowerTea ? `${ingredients.flowerTea}` : "";
        const flowerType = selectedDrink.ingredients.flowerName || "";

        const milk = ingredients.milk ? `${ingredients.milk}` : "";
        const sugar = finalSugar ? `${finalSugar}` : "";
        const sugarType = selectedDrink.ingredients.sugarName || "";

        const base = selectedDrink.ingredients.base || "";
        const mix = ingredients.mix ? `${ingredients.mix}` : "";
        const syrup = ingredients.syrup ? `${ingredients.syrup}` : "";
        const secondarySyrup = ingredients.secondarySyrup ? `${ingredients.secondarySyrup}` : "";
        const syrupName = selectedDrink.ingredients.syrupName || "";
        const secondaryFlowerTeaType = selectedDrink.ingredients.secondaryFlowerName || "";
        const secondaryFlowerTea = ingredients.secondaryFlowerTea ? `${ingredients.secondaryFlowerTea}` : "";

        const secondarySyrupName = selectedDrink.ingredients.secondarySyrupName || "";
        const fruits = selectedDrink.ingredients.fruits || "";
        const juice = ingredients.juice ? `${ingredients.juice}` : "";

        const sliceCount = size === "Large" ? 2 : 1;
        const slices = selectedDrink.ingredients.fruit ? `Add ${sliceCount} ${selectedDrink.ingredients.fruit} ->` : "";

        // Ice and toppings parts
        const iceStep = iceLevel !== 0 ? "-> Add ice ->" : "";
        const toppingsString = toppings.length > 0 ? `Add ${toppings.join(", ")} ->` : "";

        // Replace placeholders in the build
        const buildString = build
                            ? build
                                .replace("{milk}", milk)
                                .replace("{flowerTea}", flowerTea)
                                .replace("{flowerType}", flowerType)
                                .replace("{sugar}", sugar)
                                .replace("{sugarType}", sugarType)
                                .replace("{mix}", mix)
                                .replace("{syrupName}", syrupName)
                                .replace("{secondaryFlowerTeaType}", secondaryFlowerTeaType)
                                .replace("{secondaryFlowerTea}", secondaryFlowerTea)
                                .replace("{syrup}", syrup)
                                .replace("{secondarySyrup}", secondarySyrup)
                                .replace("{secondarySyrupName}", secondarySyrupName)
                                .replace("{fruits}", fruits)
                                .replace("{juice}", juice)
                                .replace("{slices}", slices)
                            : "";

        // Final recipe by replacing in the main format
        const finalRecipe = format
            .replace("{toppings}", toppingsString)
            .replace("{build}", buildString)
            .replace("{iceStep}", iceStep)
            .replace("{base}", base);

        setRecipe(finalRecipe);
    };

    return (
        <div
            style={{
                fontFamily: "Arial, sans-serif",
                maxWidth: "600px",
                margin: "20px auto",
                padding: "20px",
                border: "1px solid #ddd",
                borderRadius: "8px",
                boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1)",
                backgroundColor: "#f9f9f9",
            }}
        >
            <h1
                style={{
                    textAlign: "center",
                    fontSize: "24px",
                    color: "#333",
                    marginBottom: "20px",
                }}
            >
                Boba Recipe Calculator
            </h1>

            <button
                onClick={handleUseCamera}
                style={{
                    display: "block",
                    width: "100%",
                    padding: "10px",
                    backgroundColor: "#007BFF",
                    color: "#fff",
                    border: "none",
                    borderRadius: "5px",
                    cursor: "pointer",
                    fontSize: "16px",
                    marginBottom: "20px",
                }}
            >
                Open Camera
            </button>

            {cameraOn && (
                <div style={{ position: "relative" }}>
                    <video
                        ref={videoRef}
                        style={{
                            width: "100%",
                            borderRadius: "8px",
                            marginBottom: "10px",
                        }}
                        autoPlay
                        muted
                    />
                    <button
                        onClick={stopCamera}
                        style={{
                            position: "absolute",
                            top: "10px",
                            right: "10px",
                            padding: "10px",
                            backgroundColor: "#dc3545",
                            color: "#fff",
                            border: "none",
                            borderRadius: "5px",
                            cursor: "pointer",
                        }}
                    >
                        Cancel
                    </button>
                </div>
            )}

            <div style={{ marginBottom: "20px" }}>
                <Select
                    options={drinkOptions}
                    value={drink}
                    onChange={(selected) => {
                        setDrink(selected);
                        setToppings([]);
                    }}
                    placeholder="Select a drink"
                    isSearchable
                    styles={{
                        control: (provided) => ({
                            ...provided,
                            borderRadius: "5px",
                            padding: "5px",
                        }),
                    }}
                />
            </div>

            <div style={{ marginBottom: "20px" }}>
                <select
                    value={size || ""}
                    onChange={(e) => setSize(e.target.value)}
                    style={{
                        width: "100%",
                        padding: "10px",
                        borderRadius: "5px",
                        border: "1px solid #ddd",
                        marginBottom: "10px",
                    }}
                >
                    <option value="" disabled>
                        Select size
                    </option>
                    <option value="Medium">Medium</option>
                    <option value="Large">Large</option>
                </select>
            </div>

            {availableIceLevels.length > 0 && (
                <div style={{ marginBottom: "20px" }}>
                    <select
                        value={iceLevel !== null ? iceLevel : ""}
                        onChange={(e) => setIceLevel(Number(e.target.value))}
                        style={{
                            width: "100%",
                            padding: "10px",
                            borderRadius: "5px",
                            border: "1px solid #ddd",
                            marginBottom: "10px",
                        }}
                    >
                        <option value="" disabled>
                            Select ice level
                        </option>
                        {availableIceLevels.map((level) => (
                            <option key={level} value={level}>
                                Ice {level}%
                            </option>
                        ))}
                    </select>
                </div>
            )}

            {availableSugarLevels.length > 0 && (
                <div style={{ marginBottom: "20px" }}>
                    <select
                        value={sugarLevel !== null ? sugarLevel : ""}
                        onChange={(e) => setSugarLevel(Number(e.target.value))}
                        style={{
                            width: "100%",
                            padding: "10px",
                            borderRadius: "5px",
                            border: "1px solid #ddd",
                            marginBottom: "10px",
                        }}
                    >
                        <option value="" disabled>
                            Select sugar level
                        </option>
                        {availableSugarLevels.map((level) => (
                            <option key={level} value={level}>
                                Sugar {level}%
                            </option>
                        ))}
                    </select>
                </div>
            )}

            {availableToppings.length > 0 && (
                <>
                    <Select
                        options={availableToppings.map((t) => ({
                            value: t,
                            label: t,
                        }))}
                        value={
                            toppings[0]
                            ? { value: toppings[0], label: toppings[0] }
                            : null
                        }
                        onChange={(selected) =>
                            setToppings(
                                [selected ? selected.value : null, toppings[1] || null]
                                    .filter(Boolean)
                            )
                        }
                        placeholder="Choose topping"
                        isClearable
                        styles={{
                            control: (provided) => ({
                                ...provided,
                                borderRadius: "5px",
                                padding: "5px",
                                marginBottom: "10px",
                            }),
                        }}
                    />
                    {toppings[0] && (
                        <Select
                            options={availableToppings
                                .filter((t) => t !== toppings[0])
                                .map((t) => ({ value: t, label: t }))}
                            value={
                                toppings[1]
                                ? { value: toppings[1], label: toppings[1] }
                                : null
                            }
                            onChange={(selected) =>
                                setToppings(
                                    [toppings[0], selected ? selected.value : null]
                                        .filter(Boolean)
                                )
                            }
                            placeholder="Choose second topping"
                            isClearable
                            styles={{
                                control: (provided) => ({
                                    ...provided,
                                    borderRadius: "5px",
                                    padding: "5px",
                                }),
                            }}
                        />
                    )}
                </>
            )}

            {loadingOCR && (
                <p
                    style={{
                        color: "#007BFF",
                        fontWeight: "bold",
                        textAlign: "center",
                    }}
                >
                    Scanning...
                </p>
            )}

            {recognizedText && (
                <div>
                    <h3
                        style={{
                            fontSize: "18px",
                            fontWeight: "bold",
                            color: "#333",
                            marginBottom: "10px",
                        }}
                    >
                        Recognized Text:
                    </h3>
                    <p style={{ color: "#555" }}>{recognizedText}</p>
                </div>
            )}

            <button
                onClick={calculateRecipe}
                style={{
                    display: "block",
                    width: "100%",
                    padding: "10px",
                    backgroundColor: "#28a745",
                    color: "#fff",
                    border: "none",
                    borderRadius: "5px",
                    cursor: "pointer",
                    fontSize: "16px",
                    marginTop: "20px",
                }}
            >
                Calculate Recipe
            </button>

            {recipe && (
                <p
                    style={{
                        marginTop: "20px",
                        padding: "10px",
                        border: "1px solid #ddd",
                        borderRadius: "5px",
                        backgroundColor: "#e9ecef",
                        color: "#333",
                    }}
                >
                    {recipe}
                </p>
            )}
        </div>

    );
}
