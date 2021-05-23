import React, { Component } from 'react';

import Image from '../../../components/Image/Image';
import { API_URL } from '../../../constants';
import './SinglePost.css';

class SinglePost extends Component {
  state = {
    title: '',
    author: '',
    date: '',
    image: '',
    content: ''
  };

  componentDidMount() {
    const postId = this.props.match.params.postId;
    const graphqlQuery = {
      query: `
        query getPost($id: ID!) {
          post(id: $id) {
            _id
            title
            content
            imageUrl
            createdAt
            creator {
              name
            }
          }
        }
      `,
      variables: {
        id: postId,
      }
    }
    fetch(`${API_URL}/graphql`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.props.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(graphqlQuery),
    })
      .then(res => {
        if (res.status !== 200) {
          throw new Error('Failed to fetch status');
        }
        return res.json();
      })
      .then(resData => {
        const errorStatusCode =
          resData.errors &&
          resData.errors[0] &&
          resData.errors[0].statusCode;
        if (errorStatusCode === 401 || errorStatusCode === 404 ) {
          throw new Error(`Could not fetch post. ${resData.errors[0].message}`);
        }
        if (resData.errors) {
          throw new Error("Could not fetch post.")
        }
        this.setState({
          title: resData.data.post.title,
          author: resData.data.post.creator.name,
          image: `${API_URL}/${resData.data.post.imageUrl}`,
          date: new Date(resData.data.post.createdAt).toLocaleDateString('en-US'),
          content: resData.data.post.content,
        });
      })
      .catch(err => {
        console.log(err);
      });
  }

  render() {
    return (
      <section className="single-post">
        <h1>{this.state.title}</h1>
        <h2>
          Created by {this.state.author} on {this.state.date}
        </h2>
        <div className="single-post__image">
          <Image contain imageUrl={this.state.image} />
        </div>
        <p>{this.state.content}</p>
      </section>
    );
  }
}

export default SinglePost;
