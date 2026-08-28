import torch
from transformers import Qwen2VLForConditionalGeneration, AutoProcessor

model = None
processor = None

def load_model(model_name):
    global model, processor
    if model is None:
        if torch.cuda.is_available():
            print(f"Loading {model_name} with GPU acceleration and CPU offloading...")
            # Limit GPU VRAM usage to 3.5GB to fit inside 4GB cards, avoiding disk offload
            max_memory = {
                0: "3.5GB",     
                "cpu": "50GB"   
            }
            model = Qwen2VLForConditionalGeneration.from_pretrained(
                model_name,
                torch_dtype=torch.float16,
                device_map="auto",
                max_memory=max_memory
            )
        else:
            print(f"WARNING: No GPU detected by PyTorch! Loading {model_name} on CPU. Processing will be very slow.")
            model = Qwen2VLForConditionalGeneration.from_pretrained(
                model_name,
                torch_dtype=torch.float16,
                device_map="cpu"
            )
            
        processor = AutoProcessor.from_pretrained(model_name)
        print("Model loaded.")

def extract_transactions(image, model_name, prompt_text):
    load_model(model_name)
    
    messages = [
        {
            "role": "user",
            "content": [
                {"type": "image", "image": image},
                {"type": "text", "text": prompt_text},
            ],
        }
    ]
    
    # Preparation for generation
    text = processor.apply_chat_template(messages, tokenize=False, add_generation_prompt=True)
    inputs = processor(
        text=[text],
        images=[image],
        padding=True,
        return_tensors="pt",
    )
    inputs = inputs.to(model.device)
    
    # Generate
    generated_ids = model.generate(**inputs, max_new_tokens=1024)
    generated_ids_trimmed = [
        out_ids[len(in_ids):] for in_ids, out_ids in zip(inputs.input_ids, generated_ids)
    ]
    output_text = processor.batch_decode(
        generated_ids_trimmed, skip_special_tokens=True, clean_up_tokenization_spaces=False
    )
    
    return output_text[0]
