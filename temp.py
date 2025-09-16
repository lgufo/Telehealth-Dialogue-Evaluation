import json
import re

# 关键词列表
doctor_keywords = ['图片', '照片', '看图', '看到了', '语音', '听起来', '录音', '视频']
patient_keywords = ['图片', '照片', '语音', '录音', '视频']

def contains_keywords(text, keywords):
    return any(kw in text for kw in keywords)

def check_dialogue(dialogue):
    doctor_has = False
    patient_has = False
    for msg in dialogue:
        if msg['speaker'] == '医生' and contains_keywords(msg['lines'], doctor_keywords):
            doctor_has = True
        if msg['speaker'] == '病人' and contains_keywords(msg['lines'], patient_keywords):
            patient_has = True
    return doctor_has and not patient_has

with open('labeled_120_200_processed_cn_telehealth_2020.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

suspect_dialogue_ids = []
for item in data:
    dialogue = item['data_sample']['dialogue']
    dialogue_id = item['data_sample']['dialogue_id']
    if check_dialogue(dialogue):
        suspect_dialogue_ids.append(dialogue_id)

print("疑似原本包含图片、语音等信息的 dialogue_id：")
print(suspect_dialogue_ids)

# save the not suspect dialogue to a new json file
cleaned_data = [item for item in data if item['data_sample']['dialogue_id'] not in suspect_dialogue_ids]
with open(
    "labeled_1_120_processed_cn_telehealth_2020.json", "w", encoding="utf-8"
) as f:
    json.dump(cleaned_data, f, ensure_ascii=False, indent=4)
print(f"已保存清理后的数据，共 {len(cleaned_data)} 条记录。")