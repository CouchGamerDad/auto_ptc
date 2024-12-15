import pyautogui
import subprocess
import time

# Function to change the VPN location using Surfshark
scroll_count = 0  # Keep track of the number of scrolls to select a new location each time

def change_vpn():
    global scroll_count
    
    print("Changing VPN...")
    
    # Step 1: Open Surfshark application
    subprocess.Popen(r"C:\Program Files\Surfshark\Surfshark.exe")
    time.sleep(5)  # Wait for the app to fully load

    # Step 2: Click to open the server list
    pyautogui.click(x=1864, y=1370)
    time.sleep(2)

    # Step 3: Scroll down to a new VPN location
    for _ in range(scroll_count + 1):  # Scroll down one extra time each time the function is called
        pyautogui.scroll(-500)  # Scroll down using the mouse wheel
        time.sleep(1)  # Small delay between scrolls
    scroll_count += 1

    # Step 4: Click on the new VPN location
    pyautogui.click(x=1605, y=857)
    pyautogui.click(x=1605, y=857)
    time.sleep(2)

    # Step 5: Click continue to connect to the new VPN location
    pyautogui.click(x=1911, y=1151)
    time.sleep(5)  # Wait for the VPN to connect

    # Step 6: Close the Surfshark application by clicking the X button
    pyautogui.click(x=2983, y=309)
    time.sleep(2)

    print("VPN changed successfully.")
