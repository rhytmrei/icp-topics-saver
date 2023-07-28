import { $query, $update, Record, StableBTreeMap, Vec, match, Result } from 'azle';
import { v4 as uuidv4 } from 'uuid';

/**
   * contract allows you to save learning topics for the given programming languages. 
   * For example - JS: learn syntax, create first class. 
   * When studying the desired topic, you can change its status to completed
*/

/**
   * topic record to save topics
*/
type Topic = Record<{
    id: string;
    title: string;
    closed: boolean;
    language_id: string;
}>

/**
   * payload record to receive values from user
*/
type TopicPayload = Record<{
    closed: boolean;
    title: string;
}>

/**
   * language record to save languages
*/
type Language = Record<{
    id: string;
    title: string;
}>

const topicStorage = new StableBTreeMap<string, Topic>(0, 44, 1_000);

const languageStorage = new StableBTreeMap<string, Language>(1, 44, 1_000);

/**
   * adds a new language to the list
   * checks if a language was not added before
   * @param {string} lang_name - a title of a language to be added
   * @returns created language or an error message
   *
*/
$update;
export function addLanguage(lang_name: string): Result<Language, string> {
    if (!findLanguageByName(lang_name).Ok) {
        const language: Language = { id: uuidv4(), title: lang_name };
        languageStorage.insert(language.id, language);

        return Result.Ok(language);
    }
    return Result.Err(`a language ${lang_name} already exists`);
}

/**
   * changes a title of an added language
   * checks if a language exists
   * 
   * @param {string} old_name - a current title of a language
   * @param {string} new_name - a new title of a language to be changed
   * @returns updated language or an error message
   *
*/
$update;
export function changeLanguageTitle(old_name: string, new_name: string): Result<Language, string> {
    const language_id: string | undefined = findLanguageByName(old_name).Ok?.id;

    if (language_id !== undefined) {
        // @ts-ignore: Object is possibly 'null'.
        return match(languageStorage.get(language_id), {
            Some: (language) => {
                const updatedLanguage: Language = { ...language, title: new_name };
                languageStorage.insert(language.id, updatedLanguage);
                return Result.Ok<Language, string>(updatedLanguage);
            }
        });
    }
    return Result.Err(`a language ${old_name} does not exist`);
}

/**
   * @returns all added languages
*/
$query;
export function getLanguages(): Result<Vec<Language>, string> {
    return Result.Ok(languageStorage.values());
}

/**
   * gets a language by its title
   * checks if a language exists
   * 
   * @param {string} lang_name - a title of a language
   * @returns Language Record
   *
*/
$query;
export function findLanguageByName(lang_name: string): Result<Language, string> {

    const languages: Language[] = languageStorage.values();

    const res: Language | undefined = languages.find(element => element.title === lang_name);

    if (res === undefined) {
        return Result.Err<Language, string>(`a language ${lang_name} not found`)
    } else {
        // @ts-ignore: Object is possibly 'null'.
        return match(languageStorage.get(res.id), {
            Some: (language) => Result.Ok<Language, string>(language)
        });
    }
}

/**
   * removes a language by its id
   * also removes every topic created on this language
   * @param {string} id - an id of a language
   * @returns deleted Language Record
   *
*/
$update;
export function deleteLanguage(id: string): Result<Language, string> {
    return match(languageStorage.remove(id), {
        Some: (deletedLanguage) => {

            topicStorage.values().forEach((t) => {
                if (t.language_id === id)
                    topicStorage.remove(t.id);
            });

            return Result.Ok<Language, string>(deletedLanguage)
        },
        None: () => Result.Err<Language, string>(`couldn't delete a language with id=${id}. not found.`)
    });
}

/**
   * creates a new topic
   * checks if a language exists
   * checks if a topic was not created before
   * 
   * @param {TopicPayload} payload - data of a topic to be created
   * @param {string} lang_name - title of a language
   * @returns created Topic Record
   *
*/
$update;
export function addTopic(payload: TopicPayload, lang_name: string): Result<Topic, string> {
    const language_id: string | undefined = findLanguageByName(lang_name).Ok?.id;

    if (language_id !== undefined) {

        const topics = getAllTopicsByLanguage(lang_name);

        //check if a topic was not added before 
        if (topics.Ok && topics.Ok.find((v) => v.title === payload.title)) {
            return Result.Err(`a topic already exists`);
        } else {
            const topic: Topic = { id: uuidv4(), language_id, ...payload };

            topicStorage.insert(topic.id, topic);

            return Result.Ok(topic);
        }
    }

    return Result.Err(`a language ${lang_name} not found`);
}

/**
   * gets all topic by their language
   * checks if a language exists
   * 
   * @param {string} lang_name - title of a language
   * @returns Topic Record Vector or Error
   *
*/
$query;
export function getAllTopicsByLanguage(lang_name: string): Result<Vec<Language>, string> {
    const language_id: string | undefined = findLanguageByName(lang_name).Ok?.id;

    if (language_id !== undefined) {
        const topics: Topic[] = topicStorage.values();

        // filter all of the topics to get a topic with specified language
        const res: Language[] = topics.filter(el => el.language_id === language_id);

        return Result.Ok(res);
    }

    return Result.Err(`a language ${lang_name} not found`);
}

/**
   * updates a topic parameters
   * checks if a language exists
   * 
   * @param {string} id - id of a topic
   * @param {TopicPayload} payload - a new data of a topic to be updated
   * @returns Topic Record Vector or Error
   *
*/
$update;
export function updateTopic(id: string, payload: TopicPayload): Result<Topic, string> {
    return match(topicStorage.get(id), {
        Some: (topic) => {
            const updatedTopic: Topic = { ...topic, ...payload };
            topicStorage.insert(topic.id, updatedTopic);
            return Result.Ok<Topic, string>(updatedTopic);
        },
        None: () => Result.Err<Topic, string>(`couldn't update a topic with id=${id}. not found`)
    });
}

/**
   * gets a topics by status
   * 
   * @param {boolean} closed - needed status, closed = true | active = false
   * @param {TopicPayload} payload - a new data of a topic to be updated
   * @returns Topic Record Vector
   *
*/
$query;
export function getTopicsByStatus(closed: boolean): Result<Vec<Topic>, string> {

    const topics: Topic[] = topicStorage.values();

    var res_: Topic[] = [];

    // loop of every language
    for (var language of languageStorage.values()) {

        // find a topic with specified status
        let temp: Topic[] = topics.filter(el => el.language_id === language.id && el.closed == closed);

        res_.push(...temp);
    }

    return Result.Ok(res_);
}

/**
   * removes a topic by its id
   * @param {string} id - an id of a topic
   * @returns deleted Topic Record
   *
*/
$update;
export function deleteTopic(id: string): Result<Topic, string> {
    return match(topicStorage.remove(id), {
        Some: (deletedTopic) => Result.Ok<Topic, string>(deletedTopic),
        None: () => Result.Err<Topic, string>(`couldn't delete a topic with id=${id}. not found.`)
    });
}

$query;
export function getTopicsByLanguage(lang_name: string): Result<Vec<Topic>, string> {
  const language = findLanguageByName(lang_name).Ok;
  if (language) {
    const topics = topicStorage.values().filter(topic => topic.language_id === language.id);
    return Result.Ok(topics);
  }
  return Result.Err(`Language '${lang_name}' not found.`);
}

$update;
export function updateTopicStatus(id: string, closed: boolean): Result<Topic, string> {
  const topic = topicStorage.get(id);
  if (topic.Some) {
    const updatedTopic = { ...topic.Some, closed };
    topicStorage.insert(topic.Some.id, updatedTopic);
    return Result.Ok(updatedTopic);
  }
  return Result.Err(`Topic with ID '${id}' not found.`);
}

$query;
export function searchTopics(query: string): Result<Vec<Topic>, string> {
  const topics = topicStorage.values().filter(topic => topic.title.toLowerCase().includes(query.toLowerCase()));
  return Result.Ok(topics);
}

// type to save languages statistics
type Stats = Record<{
    title: string;
    count: number;
}>

$query;
export function getLanguageStatistics(): Result<Vec<Stats>, string> {
  const languages = languageStorage.values();
  let statistics: Stats[] = [];

  for (const language of languages) {
    const topicsCount = topicStorage.values().filter(topic => topic.language_id === language.id).length;
    statistics.push({title: language.title, count: topicsCount});
  }

  return Result.Ok(statistics);
}

// a workaround to make uuid package work with Azle
globalThis.crypto = {
  getRandomValues: () => {
    let array = new Uint8Array(32)

    for (let i = 0; i < array.length; i++) {
      array[i] = Math.floor(Math.random() * 256)
    }

    return array
  }
}
