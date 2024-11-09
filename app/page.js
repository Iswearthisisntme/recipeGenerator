"use client";

import { useState, useEffect } from 'react';
import Select from 'react-select';
import dynamic from 'next/dynamic';
import Tesseract from 'tesseract.js';
import recipeData from '../recipes.json';

export default function Home() {
    const Select = dynamic(() => import('react-select'), { ssr: false });
    const [drink, setDrink] = useState(null);
    const [size, setSize] = useState('Medium');
    const [iceLevel, setIceLevel] = useState(100);
    const [sugarLevel, setSugarLevel] = useState(100);
    const [toppings, setToppings] = useState([]);
    const [recipe, setRecipe] = useState('');
    const [loadingOCR, setLoadingOCR] = useState(false);

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

    // Function to open camera, capture image, and perform OCR
    const handleUseCamera = async () => {
        try {
            setLoadingOCR(true);

            // Access the camera
            const stream = await navigator.mediaDevices.getUserMedia({ video: true });
            const video = document.createElement('video');
            video.srcObject = stream;
            await video.play();

            // Capture the image when the video is ready
            const canvas = document.createElement('canvas');
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            canvas.getContext('2d').drawImage(video, 0, 0);

            // Stop the camera
            stream.getTracks().forEach(track => track.stop());

            // Perform OCR on the captured image
            const { data: { text } } = await Tesseract.recognize(canvas, 'eng');
            setLoadingOCR(false);

            // Process OCR result
            processOCRText(text);
        } catch (error) {
            console.error("Error using camera or processing OCR:", error);
            setLoadingOCR(false);
        }
    };

    // Process OCR text to auto-fill inputs
    const processOCRText = (text) => {
        const drinkOption = drinkOptions.find(option => text.includes(option.label));
        if (drinkOption) setDrink(drinkOption);

        if (text.includes("Large")) setSize("Large");
        else if (text.includes("Medium")) setSize("Medium");

        if (text.includes("No Ice")) setIceLevel(0);
        else if (text.includes("Light Ice")) setIceLevel(25);
        else if (text.includes("Half Ice")) setIceLevel(50);
        else if (text.includes("Less Ice")) setIceLevel(75);
        else setIceLevel(100);

        if (text.includes("No Sugar")) setSugarLevel(0);
        else if (text.includes("Light Sugar")) setSugarLevel(25);
        else if (text.includes("Half Sugar")) setSugarLevel(50);
        else if (text.includes("Less Sugar")) setSugarLevel(75);
        else setSugarLevel(100);
    };

    const calculateRecipe = () => {
        if (!drink) {
            setRecipe("Please select a drink");
            return;
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
        <div>
            <h1>Boba Recipe Calculator</h1>

            <button onClick={handleUseCamera} disabled={loadingOCR}>
                {loadingOCR ? "Processing..." : "Use Camera"}
            </button>

            <Select
                options={drinkOptions}
                value={drink}
                onChange={(selected) => {
                    setDrink(selected);
                    setToppings([]);
                }}
                placeholder="Select a drink"
                isSearchable
            />

            <select value={size} onChange={(e) => setSize(e.target.value)}>
                <option value="Medium">Medium</option>
                <option value="Large">Large</option>
            </select>

            {availableIceLevels.length > 0 && (
                <select value={iceLevel} onChange={(e) => setIceLevel(Number(e.target.value))}>
                    {availableIceLevels.map(level => (
                        <option key={level} value={level}>Ice {level}%</option>
                    ))}
                </select>
            )}

            {availableSugarLevels.length > 0 && (
                <select value={sugarLevel} onChange={(e) => setSugarLevel(Number(e.target.value))}>
                    {availableSugarLevels.map(level => (
                        <option key={level} value={level}>Sugar {level}%</option>
                    ))}
                </select>
            )}

            {availableToppings.length > 0 && (
                <>
                    <Select
                        options={availableToppings.map(t => ({value: t, label: t}))}
                        value={toppings[0] ? {value: toppings[0], label: toppings[0]} : null}
                        onChange={(selected) => setToppings([selected ? selected.value : null, toppings[1] || null].filter(Boolean))}
                        placeholder="Choose topping"
                        isClearable
                    />
                    {toppings[0] && (
                        <Select
                            options={availableToppings.filter(t => t !== toppings[0]).map(t => ({value: t, label: t}))}
                            value={toppings[1] ? {value: toppings[1], label: toppings[1]} : null}
                            onChange={(selected) => setToppings([toppings[0], selected ? selected.value : null].filter(Boolean))}
                            placeholder="Choose second topping"
                            isClearable
                        />
                    )}
                </>
            )}

            <button onClick={calculateRecipe}>Calculate Recipe</button>

            {recipe && <p>{recipe}</p>}
        </div>
    );
}
