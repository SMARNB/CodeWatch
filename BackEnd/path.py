from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
import time
import requests
import io
from PIL import Image
from rich import traceback

traceback.install()

PATH = "C:/Users/38622/OneDrive/Documents/FYP/chromedriver.exe"
service = Service(PATH)

chrome_options = Options()
chrome_options.add_argument("--disable-gpu")
chrome_options.add_argument("--no-sandbox")
chrome_options.add_argument("--disable-dev-shm-usage")
chrome_options.add_argument(
    "user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36"
)

wd = webdriver.Chrome(service=service, options=chrome_options)

def scrape(wd, delay, max_images):
    url = "https://www.google.com/search?q=western+wear+women+dress+%27pant%2Bshort+Shirt%27&sca_esv=51fa8a2df0fccc06&udm=2&biw=2147&bih=1494&sxsrf=AHTn8zqZH1ulpLeSbjVncB6vBq0fckDzmw%3A1739732233871&ei=CTWyZ4jqNPz97_UP_Jv44As&ved=0ahUKEwjIkrfO78iLAxX8_rsIHfwNHrwQ4dUDCBE&uact=5&oq=western+wear+women+dress+%27pant%2Bshort+Shirt%27&gs_lp=EgNpbWciK3dlc3Rlcm4gd2VhciB3b21lbiBkcmVzcyAncGFudCtzaG9ydCBTaGlydCdInxpQ8AtYxhdwAXgAkAEAmAHgAaAB5gmqAQMyLTa4AQPIAQD4AQGYAgCgAgCYAwCIBgGSBwCgB44C&sclient=img"
    wd.get(url)
    time.sleep(3)

    image_urls = set()
    thumbnail_class = "YQ4gaf"  
    full_image_class = "iPVvYb"

    def scroll_down():
        wd.execute_script("window.scrollBy(0,document.body.scrollHeight)")
        time.sleep(delay)

    while len(image_urls) < max_images:
        scroll_down()

        try:
            thumbnails = WebDriverWait(wd, 10).until(
                EC.presence_of_all_elements_located((By.CLASS_NAME, thumbnail_class))
            )
            print(f"Found {len(thumbnails)} thumbnails.")

            for img in thumbnails:
                if len(image_urls) >= max_images:
                    break

                try:
                    img.click()
                    time.sleep(delay)

                    images = wd.find_elements(By.CLASS_NAME, full_image_class)
                    for image in images:
                        src = image.get_attribute("src")
                        if src and "http" in src and src not in image_urls:
                            image_urls.add(src)
                            print(f"Collected Image {len(image_urls)}")

                        if len(image_urls) >= max_images:
                            break
                except Exception as e:
                    print("Error clicking image:", e)
                    continue

        except Exception as e:
            print("Error finding thumbnails:", e)
            break

    return list(image_urls)

def download(dpath, url, file_name):
    try:
        image_content = requests.get(url, timeout=10).content
        image_file = io.BytesIO(image_content)
        image = Image.open(image_file).convert("RGB")
        file_path = f"{dpath}/{file_name}.jpg"

        with open(file_path, "wb") as f:
            image.save(f, "JPEG")
        print(f"Downloaded: {file_name}.jpg")
    except Exception as e:
        print(f"Failed to download {file_name}: {e}")


image_urls = scrape(wd, 2, 100)


for i, url in enumerate(image_urls):
    download("dataset/train/images", url, f"train_{i+401}")

wd.quit()
